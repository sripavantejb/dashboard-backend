import { SalesEmployee, SalesLead, User } from '../../../models/index.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/logger/index.js';

export type LeadVerdict = 'ok' | 'suspicious' | 'mock';

const FAKE_TEXT = /\b(test|demo|fake|mock|sample|dummy|asdf|qwerty|xxx+|unknown|n\/a)\b/i;
const SEQUENTIAL = new Set(['1234567890', '9876543210', '0123456789', '1234512345']);

export function indianMobileDigits(raw?: string | null) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** Rule checks that do not call the model. Hard failures stay mock even if the model disagrees. */
export function inspectLead(lead: {
  contactPerson?: string;
  company?: string;
  phone?: string;
  email?: string;
  city?: string;
  requirement?: string;
  notes?: string;
}, duplicatePhone: boolean): { verdict: LeadVerdict; reasons: string[]; hard: boolean } {
  const reasons: string[] = [];
  let hard = false;
  const phone = indianMobileDigits(lead.phone);
  const name = String(lead.contactPerson || '').trim();
  const company = String(lead.company || '').trim();
  const email = String(lead.email || '').trim().toLowerCase();

  if (!phone) reasons.push('Mobile number is missing');
  else if (phone.length !== 10) {
    reasons.push(`Mobile has ${phone.length} digits; an Indian mobile needs 10`);
    hard = true;
  } else if (!/^[6-9]/.test(phone)) {
    reasons.push('Mobile does not start with 6, 7, 8, or 9');
    hard = true;
  } else if (/^(\d)\1{9}$/.test(phone) || SEQUENTIAL.has(phone)) {
    reasons.push('Mobile looks like a repeated or sequential dummy number');
    hard = true;
  }
  if (duplicatePhone && phone) {
    reasons.push('This mobile is already used on another lead');
    hard = true;
  }
  if (name.length < 2 || FAKE_TEXT.test(name)) {
    reasons.push('Contact name looks like a placeholder');
    hard = true;
  }
  if (company && FAKE_TEXT.test(company)) {
    reasons.push('Company name looks like a placeholder');
    hard = true;
  }
  if (email && (/^(test|fake|demo|abc|xxx|sample)@/.test(email) || /@(example|test|mailinator|fake)\./.test(email))) {
    reasons.push('Email looks like a test address');
    hard = true;
  }
  if (!company && !lead.city && !lead.requirement && !lead.notes) {
    reasons.push('Company, city, and notes are all empty');
  }

  const verdict: LeadVerdict = hard ? 'mock' : reasons.length ? 'suspicious' : 'ok';
  return { verdict, reasons, hard };
}

type LlmItem = { id: string; verdict: LeadVerdict; reason: string };

async function askModel(rows: Array<{ id: string; contact: string; company: string; phone: string; email: string; city: string; source: string; notes: string }>): Promise<LlmItem[]> {
  if (!env.LLM_API_KEY || rows.length === 0) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.LEAD_AUDIT_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0,
        max_tokens: env.LEAD_AUDIT_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You review CRM leads for an Indian sales team. Flag leads that look invented or copy-pasted: dummy mobiles, joke names, placeholder companies, or details that do not belong together. Real people with sparse notes are ok. Reply with JSON only: {"items":[{"id":"...","verdict":"ok"|"suspicious"|"mock","reason":"one short sentence"}]}. Include every id you were given.',
          },
          { role: 'user', content: JSON.stringify({ leads: rows }) },
        ],
      }),
    });
    if (!response.ok) {
      logger.warn('Lead quality model request failed', { status: response.status });
      return [];
    }
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as { items?: LlmItem[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (error) {
    logger.warn('Lead quality model request failed', { err: error instanceof Error ? error.message : 'unknown' });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Checks recent leads for bad mobiles and mock details, then asks the model to confirm the doubtful ones. */
export async function auditLeadQuality(organizationId: string) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [leads, employees] = await Promise.all([
    SalesLead.find({ organizationId, recordStatus: 'active', createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(150)
      .select('contactPerson company phone email city source requirement notes assignedEmployeeId createdAt createdBy')
      .lean(),
    SalesEmployee.find({ organizationId, status: 'active', recordStatus: 'active', isSalesAdmin: { $ne: true } }).lean(),
  ]);
  const users = await User.find({ organizationId, _id: { $in: employees.map((e) => e.userId) } }).select('firstName lastName email').lean();
  const bdaName = new Map(employees.map((e) => {
    const u = users.find((x) => String(x._id) === String(e.userId));
    const name = u ? [u.firstName, u.lastName === '-' ? '' : u.lastName].filter(Boolean).join(' ').trim() : e.employeeCode;
    return [String(e._id), { name: name || e.employeeCode || 'BDA', code: e.employeeCode || '' }];
  }));

  const phoneCounts = new Map<string, number>();
  for (const lead of leads) {
    const phone = indianMobileDigits(lead.phone);
    if (phone.length === 10) phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
  }

  const reviewed = leads.map((lead) => {
    const phone = indianMobileDigits(lead.phone);
    const check = inspectLead({
      contactPerson: lead.contactPerson,
      company: lead.company,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      requirement: lead.requirement,
      notes: lead.notes,
    }, phone.length === 10 && (phoneCounts.get(phone) || 0) > 1);
    const employeeId = String(lead.assignedEmployeeId || '');
    const bda = bdaName.get(employeeId);
    return {
      id: String(lead._id),
      employeeId,
      bdaName: bda?.name || lead.createdBy || 'Unassigned',
      employeeCode: bda?.code || '',
      contactPerson: lead.contactPerson || '',
      company: lead.company || '',
      phone: lead.phone || '',
      email: lead.email || '',
      city: lead.city || '',
      source: lead.source || '',
      createdAt: lead.createdAt,
      verdict: check.verdict,
      reasons: check.reasons,
      hard: check.hard,
      notes: String(lead.notes || lead.requirement || '').slice(0, 160),
    };
  });

  const forModel = reviewed.filter((row) => row.verdict !== 'ok').slice(0, 25);
  const llm = await askModel(forModel.map((row) => ({
    id: row.id,
    contact: row.contactPerson,
    company: row.company,
    phone: row.phone,
    email: row.email,
    city: row.city,
    source: row.source,
    notes: row.notes,
  })));
  const llmById = new Map(llm.filter((item) => item?.id).map((item) => [String(item.id), item]));

  const flagged = reviewed.flatMap((row) => {
    const extra = llmById.get(row.id);
    let verdict = row.verdict;
    const reasons = [...row.reasons];
    if (extra?.verdict === 'mock' || extra?.verdict === 'suspicious' || extra?.verdict === 'ok') {
      if (row.hard) verdict = 'mock';
      else if (extra.verdict === 'mock') verdict = 'mock';
      else if (extra.verdict === 'ok' && verdict === 'suspicious') verdict = 'ok';
      else verdict = extra.verdict;
      if (extra.reason && !reasons.includes(extra.reason)) reasons.push(extra.reason);
    }
    if (verdict === 'ok') return [];
    return [{ ...row, verdict, reasons, hard: undefined, notes: undefined }];
  });

  const byBda = new Map<string, { employeeId: string; name: string; employeeCode: string; checked: number; mock: number; suspicious: number; leads: typeof flagged }>();
  for (const row of reviewed) {
    const key = row.employeeId || row.bdaName;
    const bucket = byBda.get(key) || { employeeId: row.employeeId, name: row.bdaName, employeeCode: row.employeeCode, checked: 0, mock: 0, suspicious: 0, leads: [] };
    bucket.checked += 1;
    byBda.set(key, bucket);
  }
  for (const lead of flagged) {
    const key = lead.employeeId || lead.bdaName;
    const bucket = byBda.get(key);
    if (!bucket) continue;
    if (lead.verdict === 'mock') bucket.mock += 1;
    else bucket.suspicious += 1;
    bucket.leads.push(lead);
  }

  const bdas = [...byBda.values()].sort((a, b) => (b.mock - a.mock) || (b.suspicious - a.suspicious) || a.name.localeCompare(b.name));
  return {
    checked: reviewed.length,
    windowDays: 90,
    model: env.LLM_API_KEY ? env.LLM_MODEL : '',
    modelReviewed: llm.length,
    totals: {
      mock: flagged.filter((l) => l.verdict === 'mock').length,
      suspicious: flagged.filter((l) => l.verdict === 'suspicious').length,
    },
    bdas,
  };
}
