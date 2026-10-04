import { ValidationError } from '../errors/index.js';

/** First URL segments reserved for the app — cannot be used as organization slugs. */
export const RESERVED_ORG_SLUGS = new Set([
  'login',
  'register',
  'dashboard',
  'bda',
  'platform-admin',
  'admin',
  'super-admin',
  'portal',
  'sales-crm',
  'careers',
  'magazine',
  'newsletter',
  'track',
  'ega',
  'refer',
  'api',
  'settings',
  'employees',
  'notifications',
  'ops',
  'crm',
  'pipeline',
  'clients',
  'projects',
  'finance',
  'growth',
  'activity',
  'assets',
  'tasks',
  'meetings',
  'documents',
  'invoices',
  'payments',
  'revenue',
  'import',
  'calling',
  'reports',
  'automation',
  'tracker',
  'credentials',
  'analytics',
  'leave',
  'knowledge',
  'conversions',
  'proposals',
  'follow-ups',
  'lead-lists',
  'lead-table',
  'marketing',
  'projects-vault',
  'outstanding',
  'recurring-payments',
  'transactions',
  'sow-templates',
  'sows',
  'content-calendar',
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeOrgSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function assertOrgSlug(slug: string): string {
  const normalized = normalizeOrgSlug(slug);
  if (!normalized || normalized.length < 2 || normalized.length > 64 || !SLUG_RE.test(normalized)) {
    throw new ValidationError('Slug must be 2–64 characters: lowercase letters, numbers, and hyphens');
  }
  if (RESERVED_ORG_SLUGS.has(normalized)) {
    throw new ValidationError(`Slug "${normalized}" is reserved`);
  }
  return normalized;
}
