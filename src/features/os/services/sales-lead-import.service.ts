import * as XLSX from 'xlsx';
import {
  SALES_LEAD_SOURCES,
  SALES_LEAD_STATUSES,
  SALES_LEAD_TEMPERATURES,
  LEAD_PRIORITIES,
} from '../../../shared/constants/os.js';
import { parseCSV } from '../../../shared/utils/csv.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { SalesFollowUp, SalesLead } from '../../../models/index.js';

export const SALES_LEAD_IMPORT_COLUMNS = [
  { key: 'contactPerson', required: true, description: 'Full name of the contact (required)' },
  { key: 'company', required: false, description: 'Company or business name' },
  { key: 'phone', required: false, description: 'Phone with country code, e.g. +919876543210' },
  { key: 'email', required: false, description: 'Valid email address' },
  { key: 'website', required: false, description: 'Company website URL' },
  { key: 'city', required: false, description: 'City' },
  { key: 'state', required: false, description: 'State / region' },
  { key: 'country', required: false, description: 'Country' },
  { key: 'source', required: false, description: `One of: ${SALES_LEAD_SOURCES.join(' | ')}` },
  { key: 'campaign', required: false, description: 'Campaign or ad name' },
  { key: 'industry', required: false, description: 'Industry vertical' },
  { key: 'requirement', required: false, description: 'What they need' },
  { key: 'priority', required: false, description: `One of: ${LEAD_PRIORITIES.join(' | ')}` },
  { key: 'temperature', required: false, description: `One of: ${SALES_LEAD_TEMPERATURES.join(' | ')}` },
  { key: 'status', required: false, description: `One of: ${SALES_LEAD_STATUSES.join(' | ')}` },
  { key: 'territory', required: false, description: 'Territory or zone' },
  { key: 'notes', required: false, description: 'Free-text notes' },
  { key: 'tags', required: false, description: 'Semicolon-separated tags, e.g. vip;q1' },
  { key: 'nextFollowUpAt', required: false, description: 'Callback date YYYY-MM-DD or YYYY-MM-DDTHH:mm' },
] as const;

const HEADER_ALIASES: Record<string, string> = {
  contactperson: 'contactPerson',
  contact_person: 'contactPerson',
  contact: 'contactPerson',
  name: 'contactPerson',
  full_name: 'contactPerson',
  fullname: 'contactPerson',
  lead_name: 'contactPerson',
  lead: 'contactPerson',
  company: 'company',
  organization: 'company',
  org: 'company',
  company_name: 'company',
  phone: 'phone',
  mobile: 'phone',
  cellphone: 'phone',
  cell: 'phone',
  phone_number: 'phone',
  mobilenumber: 'phone',
  email: 'email',
  email_address: 'email',
  mail: 'email',
  website: 'website',
  url: 'website',
  web: 'website',
  city: 'city',
  state: 'state',
  country: 'country',
  source: 'source',
  lead_source: 'source',
  campaign: 'campaign',
  industry: 'industry',
  requirement: 'requirement',
  priority: 'priority',
  temperature: 'temperature',
  temp: 'temperature',
  status: 'status',
  lead_status: 'status',
  territory: 'territory',
  notes: 'notes',
  note: 'notes',
  remark: 'notes',
  remarks: 'notes',
  tags: 'tags',
  tag: 'tags',
  nextfollowupat: 'nextFollowUpAt',
  next_follow_up_at: 'nextFollowUpAt',
  next_follow_up: 'nextFollowUpAt',
  follow_up: 'nextFollowUpAt',
  followup: 'nextFollowUpAt',
  follow_up_date: 'nextFollowUpAt',
  callback: 'nextFollowUpAt',
  callback_at: 'nextFollowUpAt',
  callback_date: 'nextFollowUpAt',
};

const MAX_ROWS = 500;
const SUPPORTED_FORMATS = ['.csv', '.tsv', '.txt', '.xlsx', '.xls', '.xlsm', '.xlsb', '.ods'] as const;

const SAMPLE_MATRIX: string[][] = [
  [
    'Priya Sharma',
    'Sunrise Clinics',
    '+919876543210',
    'priya@sunriseclinics.in',
    'https://sunriseclinics.in',
    'Hyderabad',
    'Telangana',
    'India',
    'website',
    'spring_ads',
    'Healthcare',
    'Need Instagram + Google ads for new branch',
    'high',
    'hot',
    'new',
    'South',
    'Asked for a callback this week',
    'clinic;ads',
    '2026-10-10',
  ],
  [
    'Rahul Mehta',
    'Orbit Retail',
    '+918888777666',
    'rahul@orbitretail.com',
    '',
    'Mumbai',
    'Maharashtra',
    'India',
    'referral',
    '',
    'Retail',
    'Website redesign quote',
    'medium',
    'warm',
    'contacted',
    'West',
    'Referred by existing customer',
    'retail',
    '',
  ],
  [
    'Ananya Iyer',
    '',
    '+917700112233',
    'ananya.iyer@gmail.com',
    '',
    'Bengaluru',
    'Karnataka',
    'India',
    'instagram',
    'reel_may',
    '',
    'Personal brand content package',
    'low',
    'cold',
    'new',
    '',
    '',
    '',
    '2026-10-12T15:30',
  ],
];

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function normalizeHeader(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function normalizeEnum(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function pickEnum<T extends readonly string[]>(value: string | undefined, allowed: T, fallback: T[number]): T[number] {
  if (!value) return fallback;
  const n = normalizeEnum(value);
  return (allowed as readonly string[]).includes(n) ? (n as T[number]) : fallback;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatDateValue(d: Date) {
  const hasTime = d.getHours() || d.getMinutes() || d.getSeconds();
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (!hasTime) return day;
  return `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(+value)) return formatDateValue(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    // SheetJS may leave Excel serial dates as numbers when cellDates fails.
    if (value > 20000 && value < 80000) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const d = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
        return formatDateValue(d);
      }
    }
    return String(value);
  }
  return String(value).trim();
}

function parseFollowUp(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T10:00:00`)
    : new Date(raw);
  if (Number.isNaN(+d)) return undefined;
  return d;
}

function parseTags(value?: string): string[] {
  if (!value?.trim()) return [];
  return value.split(/[;|,]/).map((t) => t.trim()).filter(Boolean).slice(0, 20);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sampleAoA(): string[][] {
  const headers = SALES_LEAD_IMPORT_COLUMNS.map((c) => c.key);
  return [headers, ...SAMPLE_MATRIX];
}

export function buildSalesLeadImportCsv(): string {
  return `${sampleAoA().map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n')}\n`;
}

export function buildSalesLeadImportXlsx(): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sampleAoA());
  // Widen columns so the sample is readable in Excel.
  ws['!cols'] = SALES_LEAD_IMPORT_COLUMNS.map((c) => ({ wch: Math.max(14, c.key.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const guide = XLSX.utils.aoa_to_sheet([
    ['Column', 'Required', 'How to fill'],
    ...SALES_LEAD_IMPORT_COLUMNS.map((c) => [c.key, c.required ? 'Yes' : 'No', c.description]),
    [],
    ['Supported upload formats', SUPPORTED_FORMATS.join(', ')],
    ['Max rows', String(MAX_ROWS)],
  ]);
  guide['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, guide, 'Instructions');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export function buildSalesLeadImportTemplate() {
  const xlsx = buildSalesLeadImportXlsx();
  return {
    filenameCsv: 'bda-leads-import-sample.csv',
    filenameXlsx: 'bda-leads-import-sample.xlsx',
    filename: 'bda-leads-import-sample.csv',
    csv: buildSalesLeadImportCsv(),
    xlsxBase64: xlsx.toString('base64'),
    formats: [...SUPPORTED_FORMATS],
    columns: SALES_LEAD_IMPORT_COLUMNS.map((c) => ({
      key: c.key,
      required: c.required,
      description: c.description,
    })),
    allowed: {
      source: [...SALES_LEAD_SOURCES],
      temperature: [...SALES_LEAD_TEMPERATURES],
      priority: [...LEAD_PRIORITIES],
      status: [...SALES_LEAD_STATUSES],
    },
    tips: [
      'Download the sample CSV or Excel (.xlsx) sheet — both include every field and example rows.',
      'Upload .xlsx, .xls, .csv, .tsv, .txt, .xlsm, .xlsb, or .ods (first sheet is used).',
      'contactPerson is required on every row (aliases: name, contact, full_name).',
      'Use lowercase enum values for source, temperature, priority, and status.',
      'tags: separate with semicolons (vip;q1).',
      'nextFollowUpAt creates a pending follow-up when set (YYYY-MM-DD).',
      `Maximum ${MAX_ROWS} rows per upload.`,
    ],
  };
}

function parseDelimitedText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleaned = text.replace(/^\uFEFF/, '');
  const firstLine = cleaned.split(/\r?\n/).find((l) => l.trim()) || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  if (tabCount > commaCount && tabCount > 0) {
    const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
    const headers = (lines[0] || '').split('\t').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line) => {
      const values = line.split('\t');
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = (values[i] || '').trim().replace(/^"|"$/g, '');
      });
      return row;
    });
    return { headers, rows };
  }
  return parseCSV(cleaned);
}

function parseWorkbook(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
  const nonEmpty = matrix.filter((row) => Array.isArray(row) && row.some((cell) => cellToString(cell) !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((cell) => cellToString(cell));
  const rows = nonEmpty.slice(1).map((line) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = cellToString(line[i]);
    });
    return row;
  });
  return { headers, rows };
}

export function parseLeadImportFile(buffer: Buffer, filename = 'upload.csv'): { headers: string[]; rows: Record<string, string>[]; format: string } {
  const lower = filename.toLowerCase();
  const ext = (SUPPORTED_FORMATS.find((f) => lower.endsWith(f)) || '').replace('.', '') || 'unknown';

  const isExcel =
    /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(lower)
    || (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) // zip / xlsx
    || (buffer.length >= 8 && buffer[0] === 0xd0 && buffer[1] === 0xcf); // ole / xls

  if (isExcel) {
    try {
      const parsed = parseWorkbook(buffer);
      return { ...parsed, format: ext || 'xlsx' };
    } catch {
      throw new ValidationError('Could not read this spreadsheet. Save as .xlsx or .csv and try again.');
    }
  }

  if (ext === 'unknown' && !/\.(csv|tsv|txt)$/i.test(lower)) {
    // Try Excel first, then text — covers files without extensions.
    try {
      const parsed = parseWorkbook(buffer);
      if (parsed.headers.length) return { ...parsed, format: 'xlsx' };
    } catch {
      /* fall through to text */
    }
  }

  const text = buffer.toString('utf8');
  const parsed = parseDelimitedText(text);
  return { ...parsed, format: ext === 'tsv' || text.includes('\t') ? 'tsv' : 'csv' };
}

type MappedLead = {
  contactPerson: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
  source: (typeof SALES_LEAD_SOURCES)[number];
  campaign?: string;
  industry?: string;
  requirement?: string;
  priority: (typeof LEAD_PRIORITIES)[number];
  temperature: (typeof SALES_LEAD_TEMPERATURES)[number];
  status: (typeof SALES_LEAD_STATUSES)[number];
  territory?: string;
  notes?: string;
  tags: string[];
  nextFollowUpAt?: Date;
};

function mapRow(raw: Record<string, string>, rowNumber: number): { ok: true; lead: MappedLead } | { ok: false; error: string } {
  const mapped: Record<string, string> = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    if (!key || !value?.trim()) continue;
    mapped[key] = value.trim();
  }

  const contactPerson = mapped.contactPerson || '';
  if (contactPerson.length < 2) {
    return { ok: false, error: `Row ${rowNumber}: contactPerson is required (min 2 characters)` };
  }
  if (mapped.email && !isValidEmail(mapped.email)) {
    return { ok: false, error: `Row ${rowNumber}: invalid email "${mapped.email}"` };
  }

  const sourceRaw = mapped.source ? normalizeEnum(mapped.source) : '';
  if (sourceRaw && !(SALES_LEAD_SOURCES as readonly string[]).includes(sourceRaw)) {
    return { ok: false, error: `Row ${rowNumber}: invalid source "${mapped.source}"` };
  }
  const tempRaw = mapped.temperature ? normalizeEnum(mapped.temperature) : '';
  if (tempRaw && !(SALES_LEAD_TEMPERATURES as readonly string[]).includes(tempRaw)) {
    return { ok: false, error: `Row ${rowNumber}: invalid temperature "${mapped.temperature}"` };
  }
  const priRaw = mapped.priority ? normalizeEnum(mapped.priority) : '';
  if (priRaw && !(LEAD_PRIORITIES as readonly string[]).includes(priRaw)) {
    return { ok: false, error: `Row ${rowNumber}: invalid priority "${mapped.priority}"` };
  }
  const statusRaw = mapped.status ? normalizeEnum(mapped.status) : '';
  if (statusRaw && !(SALES_LEAD_STATUSES as readonly string[]).includes(statusRaw)) {
    return { ok: false, error: `Row ${rowNumber}: invalid status "${mapped.status}"` };
  }
  if (mapped.nextFollowUpAt && !parseFollowUp(mapped.nextFollowUpAt)) {
    return { ok: false, error: `Row ${rowNumber}: invalid nextFollowUpAt "${mapped.nextFollowUpAt}" (use YYYY-MM-DD)` };
  }

  return {
    ok: true,
    lead: {
      contactPerson,
      company: mapped.company || undefined,
      phone: mapped.phone || undefined,
      email: mapped.email || undefined,
      website: mapped.website || undefined,
      city: mapped.city || undefined,
      state: mapped.state || undefined,
      country: mapped.country || undefined,
      source: pickEnum(mapped.source, SALES_LEAD_SOURCES, 'website'),
      campaign: mapped.campaign || undefined,
      industry: mapped.industry || undefined,
      requirement: mapped.requirement || undefined,
      priority: pickEnum(mapped.priority, LEAD_PRIORITIES, 'medium'),
      temperature: pickEnum(mapped.temperature, SALES_LEAD_TEMPERATURES, 'warm'),
      status: pickEnum(mapped.status, SALES_LEAD_STATUSES, 'new'),
      territory: mapped.territory || undefined,
      notes: mapped.notes || undefined,
      tags: parseTags(mapped.tags),
      nextFollowUpAt: parseFollowUp(mapped.nextFollowUpAt),
    },
  };
}

export type SalesLeadImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  totalRows: number;
  format?: string;
  errors: Array<{ row: number; message: string }>;
  leadIds: string[];
};

export async function importSalesLeadsFromRows(opts: {
  organizationId: string;
  headers: string[];
  rows: Record<string, string>[];
  duplicateStrategy: 'skip' | 'update';
  assignedEmployeeId?: string;
  actorEmail: string;
  format?: string;
}): Promise<SalesLeadImportResult> {
  const { headers, rows } = opts;
  if (!headers.length) throw new ValidationError('File is empty — download the sample sheet and fill your rows');
  if (!rows.length) throw new ValidationError('No data rows found under the header');
  if (rows.length > MAX_ROWS) throw new ValidationError(`Too many rows (${rows.length}). Max is ${MAX_ROWS} per import.`);

  const known = headers.some((h) => HEADER_ALIASES[normalizeHeader(h)]);
  if (!known) {
    throw new ValidationError('Could not recognize any lead columns. Download the sample sheet and keep the header names.');
  }

  const result: SalesLeadImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    totalRows: rows.length,
    format: opts.format,
    errors: [],
    leadIds: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const parsed = mapRow(rows[i], rowNumber);
    if (!parsed.ok) {
      result.failed += 1;
      result.errors.push({ row: rowNumber, message: parsed.error });
      continue;
    }

    const { lead } = parsed;
    try {
      let existing: InstanceType<typeof SalesLead> | null = null;
      if (lead.email || lead.phone) {
        const or: Record<string, string>[] = [];
        if (lead.email) or.push({ email: lead.email.toLowerCase() });
        if (lead.phone) or.push({ phone: lead.phone });
        existing = await SalesLead.findOne({
          organizationId: opts.organizationId,
          recordStatus: 'active',
          $or: or,
        });
      }

      if (existing) {
        if (opts.duplicateStrategy === 'skip') {
          result.skipped += 1;
          continue;
        }
        const { nextFollowUpAt, ...fields } = lead;
        existing.set({
          ...fields,
          email: fields.email?.toLowerCase() || existing.email,
          nextFollowUpAt: nextFollowUpAt || existing.nextFollowUpAt,
          updatedBy: opts.actorEmail,
        });
        await existing.save();
        const ownerId = existing.assignedEmployeeId || opts.assignedEmployeeId;
        if (nextFollowUpAt && ownerId) {
          await SalesFollowUp.create({
            organizationId: opts.organizationId,
            leadId: existing._id,
            ownerEmployeeId: ownerId,
            type: 'call',
            dueAt: nextFollowUpAt,
            notes: 'Imported callback',
            status: 'pending',
            createdBy: opts.actorEmail,
          });
        }
        result.updated += 1;
        result.leadIds.push(String(existing._id));
        continue;
      }

      const created = await SalesLead.create({
        ...lead,
        email: lead.email?.toLowerCase() || undefined,
        organizationId: opts.organizationId,
        assignedEmployeeId: opts.assignedEmployeeId || undefined,
        createdBy: opts.actorEmail,
        updatedBy: opts.actorEmail,
      });

      const ownerId = created.assignedEmployeeId || opts.assignedEmployeeId;
      if (lead.nextFollowUpAt && ownerId) {
        await SalesFollowUp.create({
          organizationId: opts.organizationId,
          leadId: created._id,
          ownerEmployeeId: ownerId,
          type: 'call',
          dueAt: lead.nextFollowUpAt,
          notes: 'Imported callback',
          status: 'pending',
          createdBy: opts.actorEmail,
        });
      }

      result.imported += 1;
      result.leadIds.push(String(created._id));
    } catch (err) {
      result.failed += 1;
      result.errors.push({
        row: rowNumber,
        message: err instanceof Error ? err.message : 'Could not save row',
      });
    }
  }

  if (result.imported === 0 && result.updated === 0 && result.failed > 0 && result.skipped === 0) {
    throw new ValidationError(result.errors[0]?.message || 'Import failed — fix the file and try again');
  }

  result.errors = result.errors.slice(0, 50);
  return result;
}

export async function importSalesLeadsFromCsv(opts: {
  organizationId: string;
  csv: string;
  duplicateStrategy: 'skip' | 'update';
  assignedEmployeeId?: string;
  actorEmail: string;
}): Promise<SalesLeadImportResult> {
  const parsed = parseLeadImportFile(Buffer.from(opts.csv.replace(/^\uFEFF/, ''), 'utf8'), 'upload.csv');
  return importSalesLeadsFromRows({
    organizationId: opts.organizationId,
    headers: parsed.headers,
    rows: parsed.rows,
    duplicateStrategy: opts.duplicateStrategy,
    assignedEmployeeId: opts.assignedEmployeeId,
    actorEmail: opts.actorEmail,
    format: parsed.format,
  });
}

export async function importSalesLeadsFromUpload(opts: {
  organizationId: string;
  buffer: Buffer;
  filename: string;
  duplicateStrategy: 'skip' | 'update';
  assignedEmployeeId?: string;
  actorEmail: string;
}): Promise<SalesLeadImportResult> {
  const parsed = parseLeadImportFile(opts.buffer, opts.filename);
  return importSalesLeadsFromRows({
    organizationId: opts.organizationId,
    headers: parsed.headers,
    rows: parsed.rows,
    duplicateStrategy: opts.duplicateStrategy,
    assignedEmployeeId: opts.assignedEmployeeId,
    actorEmail: opts.actorEmail,
    format: parsed.format,
  });
}
