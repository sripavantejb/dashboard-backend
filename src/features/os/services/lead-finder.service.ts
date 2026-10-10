import { z } from 'zod';
import { SalesLead } from '../../../models/index.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/logger/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { indianMobileDigits, inspectLead } from './lead-quality.service.js';

const filtersSchema = z.object({
  keyword: z.string().trim().min(2).max(120),
  city: z.string().trim().max(80).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  country: z.string().trim().max(80).optional().default('India'),
  industry: z.string().trim().max(80).optional().default(''),
  titles: z.string().trim().max(160).optional().default(''),
  employeeMin: z.coerce.number().int().min(0).max(100000).optional(),
  employeeMax: z.coerce.number().int().min(0).max(100000).optional(),
  limit: z.coerce.number().int().min(5).max(20).optional().default(15),
  sources: z.array(z.enum(['web', 'maps', 'apollo'])).min(1).max(3).optional().default(['web']),
  provider: z.enum(['openai', 'gemma']).optional().default('gemma'),
  model: z.string().trim().max(80).optional().default(''),
});

export const OPENAI_LEAD_MODELS = ['gpt-4o-mini', 'gpt-4o'] as const;
export const GEMMA_LEAD_MODELS = ['gemma-4-26b-a4b-it', 'gemma-4-31b-it'] as const;

export type LeadFinderFilters = z.infer<typeof filtersSchema>;

export interface FoundLead {
  contactPerson: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  state: string;
  country: string;
  industry: string;
  source: 'google' | 'apollo' | 'website';
  title: string;
  notes: string;
}

export function leadFinderSources() {
  return {
    web: Boolean(env.LLM_API_KEY || env.GEMMA_API_KEY),
    openai: Boolean(env.LLM_API_KEY),
    gemma: Boolean(env.GEMMA_API_KEY),
    openaiModels: [...OPENAI_LEAD_MODELS],
    gemmaModels: [...GEMMA_LEAD_MODELS],
    maps: Boolean(env.GOOGLE_MAPS_API_KEY),
    apollo: Boolean(env.APOLLO_API_KEY),
    model: env.GEMMA_API_KEY ? env.GEMMA_MODEL : env.LLM_MODEL,
  };
}

function chosenModel(filters: LeadFinderFilters) {
  const allowed = filters.provider === 'gemma' ? GEMMA_LEAD_MODELS : OPENAI_LEAD_MODELS;
  const fallback = filters.provider === 'gemma' ? env.GEMMA_MODEL : env.LLM_MODEL;
  if ((allowed as readonly string[]).includes(filters.model)) return filters.model;
  if ((allowed as readonly string[]).includes(fallback)) return fallback;
  return allowed[0];
}

function placeLabel(filters: LeadFinderFilters) {
  return [filters.city, filters.state, filters.country].filter(Boolean).join(', ');
}

async function planSearch(filters: LeadFinderFilters) {
  const location = placeLabel(filters);
  const fallback = {
    mapsQuery: [filters.keyword, filters.industry, location].filter(Boolean).join(' '),
    titles: filters.titles.split(',').map((t) => t.trim()).filter(Boolean),
    keywords: [filters.keyword, filters.industry].filter(Boolean).join(' '),
  };
  if (!env.LLM_API_KEY) return fallback;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.LEAD_AUDIT_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0,
        max_tokens: 280,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Turn CRM lead filters into search parameters. Do not invent companies, people, or phone numbers. Reply JSON only: {"mapsQuery":"text search for Google Maps","titles":["job titles"],"keywords":"short apollo keyword"}.',
          },
          { role: 'user', content: JSON.stringify(filters) },
        ],
      }),
    });
    if (!response.ok) return fallback;
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}') as { mapsQuery?: string; titles?: string[]; keywords?: string };
    return {
      mapsQuery: String(parsed.mapsQuery || fallback.mapsQuery).slice(0, 200),
      titles: Array.isArray(parsed.titles) && parsed.titles.length ? parsed.titles.map((t) => String(t).slice(0, 60)).slice(0, 6) : fallback.titles,
      keywords: String(parsed.keywords || fallback.keywords).slice(0, 120),
    };
  } catch (error) {
    logger.warn('Lead finder search plan failed', { err: error instanceof Error ? error.message : 'unknown' });
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

async function searchMaps(query: string, limit: number): Promise<{ leads: FoundLead[]; message: string }> {
  if (!env.GOOGLE_MAPS_API_KEY) return { leads: [], message: 'Google Maps key is not set' };
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.addressComponents',
    },
    body: JSON.stringify({ textQuery: query, pageSize: limit, regionCode: 'IN' }),
  });
  if (!response.ok) {
    logger.warn('Google Places search failed', { status: response.status });
    return { leads: [], message: `Google Maps returned ${response.status}` };
  }
  const body = await response.json() as {
    places?: Array<{
      displayName?: { text?: string };
      formattedAddress?: string;
      nationalPhoneNumber?: string;
      internationalPhoneNumber?: string;
      websiteUri?: string;
      primaryTypeDisplayName?: { text?: string };
      addressComponents?: Array<{ longText?: string; types?: string[] }>;
    }>;
  };
  const leads = (body.places || []).map((place) => {
    const part = (type: string) => place.addressComponents?.find((c) => c.types?.includes(type))?.longText || '';
    const name = place.displayName?.text || 'Unknown business';
    return {
      contactPerson: name,
      company: name,
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
      email: '',
      website: place.websiteUri || '',
      city: part('locality'),
      state: part('administrative_area_level_1'),
      country: part('country'),
      industry: place.primaryTypeDisplayName?.text || '',
      source: 'google' as const,
      title: '',
      notes: place.formattedAddress || 'Found on Google Maps',
    };
  });
  return { leads, message: leads.length ? '' : 'Google Maps returned no places' };
}

function employeeRange(filters: LeadFinderFilters) {
  if (filters.employeeMin == null && filters.employeeMax == null) return undefined;
  const min = filters.employeeMin ?? 1;
  const max = filters.employeeMax ?? 10000;
  return [`${min},${max}`];
}

function apolloLead(raw: Record<string, unknown>, kind: 'person' | 'company'): FoundLead | null {
  const org = (raw.organization && typeof raw.organization === 'object' ? raw.organization : raw) as Record<string, unknown>;
  const phoneObj = (org.primary_phone && typeof org.primary_phone === 'object' ? org.primary_phone : {}) as Record<string, unknown>;
  const name = String(raw.name || [raw.first_name, raw.last_name].filter(Boolean).join(' ') || org.name || '').trim();
  const company = String(kind === 'person' ? org.name || raw.organization_name || '' : org.name || raw.name || '').trim();
  const phone = String(raw.sanitized_phone || raw.phone || phoneObj.number || org.phone || org.sanitized_phone || '');
  if (!name && !company) return null;
  return {
    contactPerson: name || company,
    company: company || name,
    phone,
    email: String(raw.email || ''),
    website: String(org.website_url || raw.website_url || ''),
    city: String(raw.city || org.city || ''),
    state: String(raw.state || org.state || ''),
    country: String(raw.country || org.country || ''),
    industry: String(org.industry || raw.industry || ''),
    source: 'apollo',
    title: String(raw.title || ''),
    notes: [raw.title, raw.linkedin_url].filter(Boolean).join(' · ') || 'Found on Apollo',
  };
}

async function apolloPost(path: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.apollo.io/api/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.APOLLO_API_KEY || '' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    logger.warn('Apollo search failed', { path, status: response.status });
    return { ok: false as const, status: response.status, body: {} as Record<string, unknown> };
  }
  return { ok: true as const, status: 200, body: await response.json() as Record<string, unknown> };
}

async function searchApollo(filters: LeadFinderFilters, plan: { titles: string[]; keywords: string }, limit: number) {
  if (!env.APOLLO_API_KEY) return { leads: [] as FoundLead[], message: 'Apollo key is not set' };
  const location = placeLabel(filters);
  const shared: Record<string, unknown> = { page: 1, per_page: limit };
  if (location) {
    shared.organization_locations = [location];
    shared.person_locations = [location];
  }
  const range = employeeRange(filters);
  if (range) shared.organization_num_employees_ranges = range;
  const people = await apolloPost('mixed_people/api_search', {
    ...shared,
    q_keywords: plan.keywords,
    person_titles: plan.titles.length ? plan.titles : undefined,
  });
  const companies = await apolloPost('mixed_companies/search', {
    ...shared,
    q_organization_keyword_tags: [plan.keywords],
  });
  if (!people.ok && !companies.ok) {
    return { leads: [], message: `Apollo returned ${people.status}` };
  }
  const personRows = Array.isArray(people.body.people) ? people.body.people as Record<string, unknown>[] : [];
  const companyRows = Array.isArray(companies.body.organizations) ? companies.body.organizations as Record<string, unknown>[]
    : Array.isArray(companies.body.accounts) ? companies.body.accounts as Record<string, unknown>[] : [];
  const leads = [
    ...personRows.map((row) => apolloLead(row, 'person')),
    ...companyRows.map((row) => apolloLead(row, 'company')),
  ].filter((row): row is FoundLead => Boolean(row));
  return { leads, message: leads.length ? '' : 'Apollo returned no contacts for these filters' };
}

const SKIP_HOST = /(^|\.)(facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com|wikipedia\.org|bing\.com|yahoo\.com|apollo\.io)$/i;

function skipHost(hostname: string) {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'vertexaisearch.cloud.google.com') return false;
  if (host === 'google.com' || host.endsWith('.google.com')) return true;
  return SKIP_HOST.test(host);
}

function publishedPhone(text: string) {
  const matches = text.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|\b[6-9]\d{9}\b/g) || [];
  for (const match of matches) {
    const phone = indianMobileDigits(match);
    if (phone.length !== 10) continue;
    if (inspectLead({ contactPerson: 'Office', phone }, false).hard) continue;
    if (/^(\d)\1{2,}0{4,}$/.test(phone)) continue;
    const repeats = Math.max(...phone.split('').map((digit) => phone.split(digit).length - 1));
    if (repeats >= 7) continue;
    return phone;
  }
  return '';
}

function publishedEmail(text: string) {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return matches.find((email) => {
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) return false;
    return !/@(example|test|sentry|wix|godaddy|domain)\./i.test(email) && !/^(noreply|no-reply|donotreply)@/i.test(email);
  }) || '';
}

function pageTitle(html: string, url: string) {
  const raw = html.match(/<title[^>]*>([^<]{2,140})/i)?.[1] || '';
  const title = raw.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const name = title.split(/\s+[|\-–—]\s+/)[0]?.trim() || '';
  if (name.length >= 2 && !/^(home|contact|welcome|untitled)$/i.test(name)) return name.slice(0, 120);
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Business'; }
}

async function readPublicPage(url: string) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(parsed.protocol) || skipHost(parsed.hostname)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(parsed, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': 'EditcoLeadFinder/1.0' } });
    if (!response.ok) return null;
    const finalUrl = response.url || url;
    if (skipHost(new URL(finalUrl).hostname)) return null;
    const html = (await response.text()).slice(0, 200_000);
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    return { html, text, finalUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function urlsInText(text: string) {
  return (text.match(/https?:\/\/[^\s)]+/g) || []).map((url) => url.replace(/[.,]$/, ''));
}

async function leadsFromPages(urls: string[], filters: LeadFinderFilters, limit: number) {
  const leads: FoundLead[] = [];
  for (const url of urls.slice(0, limit)) {
    if (leads.length >= limit) break;
    const page = await readPublicPage(url);
    if (!page) continue;
    const phone = publishedPhone(`${page.html} ${page.text}`);
    const email = publishedEmail(page.text);
    if (!phone && !email) continue;
    const name = pageTitle(page.html, page.finalUrl);
    const city = filters.city && page.text.toLowerCase().includes(filters.city.toLowerCase()) ? filters.city : '';
    leads.push({
      contactPerson: name,
      company: name,
      phone,
      email,
      website: page.finalUrl,
      city,
      state: filters.state && page.text.toLowerCase().includes(filters.state.toLowerCase()) ? filters.state : '',
      country: filters.country || '',
      industry: filters.industry || '',
      source: 'website',
      title: '',
      notes: `Copied from ${page.finalUrl}`,
    });
  }
  return leads;
}

async function searchWithOpenAi(query: string, model: string, signal: AbortSignal) {
  if (!env.LLM_API_KEY) return { urls: [] as string[], message: 'OpenAI key is not set' };
  const response = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, '')}/responses`, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search' }],
      input: `Search for real businesses: ${query}. Open official websites or public listings that show a phone number or email. Do not invent a business, phone, or email.`,
    }),
  });
  const body = await response.json() as {
    error?: { code?: string; message?: string };
    output?: Array<{ type?: string; content?: Array<{ text?: string; annotations?: Array<{ type?: string; url?: string }> }> }>;
  };
  if (!response.ok) {
    if (body.error?.code === 'credit_balance_exhausted' || response.status === 429) {
      return { urls: [], message: 'OpenAI has no credits left, so nothing was returned. No contacts were guessed.' };
    }
    return { urls: [], message: body.error?.message || `OpenAI search returned ${response.status}` };
  }
  const urls = new Set<string>();
  for (const item of body.output || []) {
    for (const content of item.content || []) {
      for (const note of content.annotations || []) if (note.url) urls.add(note.url);
      for (const url of urlsInText(content.text || '')) urls.add(url);
    }
  }
  return { urls: [...urls], message: '' };
}

async function searchWithGemma(query: string, model: string, signal: AbortSignal) {
  if (!env.GEMMA_API_KEY) return { urls: [] as string[], message: 'Gemma key is not set' };
  let response: Response | null = null;
  let body: {
    error?: { status?: string; message?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string } }> };
    }>;
  } = {};
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(`${env.GEMMA_BASE_URL.replace(/\/$/, '')}/models/${model}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'x-goog-api-key': env.GEMMA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Search for real businesses: ${query}. Use web results only. Do not invent a business, phone, or email.` }] }],
        tools: [{ google_search: {} }],
      }),
    });
    body = await response.json() as typeof body;
    if (response.ok || response.status < 500) break;
  }
  if (!response?.ok) {
    return { urls: [], message: body.error?.message || `Gemma search returned ${response?.status || 0}` };
  }
  const urls = new Set<string>();
  for (const candidate of body.candidates || []) {
    for (const chunk of candidate.groundingMetadata?.groundingChunks || []) {
      if (chunk.web?.uri) urls.add(chunk.web.uri);
    }
    for (const part of candidate.content?.parts || []) {
      for (const url of urlsInText(part.text || '')) urls.add(url);
    }
  }
  return { urls: [...urls], message: '' };
}

/** Search with the selected model, then keep a lead only when the phone or email is copied from the opened page. */
async function searchWeb(filters: LeadFinderFilters, limit: number): Promise<{ leads: FoundLead[]; message: string; model: string }> {
  const model = chosenModel(filters);
  const label = filters.provider === 'gemma' ? 'Gemma' : 'OpenAI';
  const query = [filters.keyword, filters.industry, placeLabel(filters)].filter(Boolean).join(' ');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let found: { urls: string[]; message: string };
  try {
    found = filters.provider === 'gemma'
      ? await searchWithGemma(query, model, controller.signal)
      : await searchWithOpenAi(query, model, controller.signal);
  } catch (error) {
    logger.warn('Lead finder web search failed', { err: error instanceof Error ? error.message : 'unknown', provider: filters.provider });
    return { leads: [], model, message: `${label} search did not finish. No contacts were guessed.` };
  } finally {
    clearTimeout(timer);
  }
  if (found.message) return { leads: [], message: found.message, model };
  const leads = await leadsFromPages(found.urls, filters, limit);
  return {
    leads,
    model,
    message: leads.length ? '' : `${label} search ran across ${found.urls.length} pages, but none published a phone or email. Nothing was guessed.`,
  };
}

function dedupe(leads: FoundLead[]) {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const phone = indianMobileDigits(lead.phone);
    const key = phone.length >= 8 ? `p:${phone}` : `n:${lead.company.toLowerCase()}|${lead.contactPerson.toLowerCase()}|${lead.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function findLeads(input: unknown) {
  const parsed = filtersSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ValidationError(first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid filters');
  }
  const filters = parsed.data;
  const wantWeb = filters.sources.includes('web');
  const wantMaps = filters.sources.includes('maps');
  const wantApollo = filters.sources.includes('apollo');
  const plan = wantMaps || wantApollo
    ? await planSearch(filters)
    : {
      mapsQuery: [filters.keyword, filters.industry, placeLabel(filters)].filter(Boolean).join(' '),
      titles: filters.titles.split(',').map((t) => t.trim()).filter(Boolean),
      keywords: [filters.keyword, filters.industry].filter(Boolean).join(' '),
    };
  const [web, maps, apollo] = await Promise.all([
    wantWeb ? searchWeb(filters, filters.limit) : Promise.resolve({ leads: [] as FoundLead[], message: 'Web search not selected', model: '' }),
    wantMaps ? searchMaps(plan.mapsQuery, filters.limit) : Promise.resolve({ leads: [] as FoundLead[], message: 'Maps not selected' }),
    wantApollo ? searchApollo(filters, plan, filters.limit) : Promise.resolve({ leads: [] as FoundLead[], message: 'Apollo not selected' }),
  ]);
  return {
    filters,
    plan,
    sources: leadFinderSources(),
    engine: { provider: filters.provider, model: web.model || chosenModel(filters) },
    messages: { web: web.message, maps: maps.message, apollo: apollo.message },
    leads: dedupe([...web.leads, ...maps.leads, ...apollo.leads]).slice(0, filters.limit * 2),
  };
}

const importLeadSchema = z.object({
  contactPerson: z.string().trim().min(2).max(160),
  company: z.string().trim().max(160).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  email: z.string().trim().max(160).optional().default(''),
  website: z.string().trim().max(300).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
  industry: z.string().trim().max(80).optional().default(''),
  source: z.enum(['google', 'apollo', 'website']),
  title: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
});

export async function importFoundLeads(organizationId: string, actorEmail: string, input: unknown) {
  const parsed = z.object({ leads: z.array(importLeadSchema).min(1).max(40) }).safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ValidationError(first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid leads');
  }
  const body = parsed.data;
  const existing = await SalesLead.find({ organizationId, recordStatus: 'active' }).select('phone email company contactPerson').lean();
  const phones = new Set(existing.map((lead) => indianMobileDigits(lead.phone)).filter((phone) => phone.length >= 8));
  const emails = new Set(existing.map((lead) => String(lead.email || '').toLowerCase()).filter(Boolean));
  let created = 0;
  let skipped = 0;
  for (const lead of body.leads) {
    const phone = indianMobileDigits(lead.phone);
    const email = lead.email.toLowerCase();
    if ((phone.length >= 8 && phones.has(phone)) || (email && emails.has(email))) {
      skipped += 1;
      continue;
    }
    if (lead.source === 'website') {
      const page = lead.website ? await readPublicPage(lead.website) : null;
      const blob = page ? `${page.html} ${page.text}` : '';
      const phoneOk = phone.length === 10 && blob.replace(/\D/g, '').includes(phone);
      const emailOk = Boolean(email) && blob.toLowerCase().includes(email);
      if (!phoneOk && !emailOk) {
        skipped += 1;
        continue;
      }
    }
    await SalesLead.create({
      organizationId,
      contactPerson: lead.contactPerson,
      company: lead.company,
      phone: lead.phone,
      email: lead.email,
      website: lead.website,
      city: lead.city,
      state: lead.state,
      country: lead.country,
      industry: lead.industry,
      source: lead.source,
      notes: [lead.title, lead.notes].filter(Boolean).join(' · '),
      createdBy: actorEmail,
      updatedBy: actorEmail,
    });
    created += 1;
    if (phone.length >= 8) phones.add(phone);
    if (email) emails.add(email);
  }
  return { created, skipped };
}
