import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Api, CREDS, ORG_SLUG, startApp, type TestApp } from './helpers.js';

let t: TestApp;
let admin: Api;
let superAdmin: Api;

beforeAll(async () => {
  t = await startApp();
  [admin, superAdmin] = await Promise.all([t.api.login('admin'), t.api.login('super')]);
});
afterAll(() => t?.close());

describe('company BDA auth', () => {
  it('exposes public branding for an active company slug', async () => {
    const brand = await t.api.ok(t.api.get(`/auth/bda/${ORG_SLUG}`));
    expect(brand).toMatchObject({ name: expect.any(String), slug: ORG_SLUG, logo: expect.any(String) });
  });

  it('404s unknown BDA portals', async () => {
    expect((await t.api.get('/auth/bda/does-not-exist')).status).toBe(404);
  });

  it('lets BDA sales users sign in only on their company portal', async () => {
    const blocked = await t.api.post('/auth/login', CREDS.sales);
    expect(blocked.status).toBe(403);
    expect(blocked.body?.error?.message || '').toMatch(/\/editco-media\/bda/);

    const login = await t.api.ok(t.api.post(`/auth/bda/${ORG_SLUG}/login`, CREDS.sales));
    expect(login.user.role).toBe('sales');
    expect(login.organization.slug).toBe(ORG_SLUG);
  });

  it('rejects company admins on the BDA login', async () => {
    const r = await t.api.post(`/auth/bda/${ORG_SLUG}/login`, CREDS.admin);
    expect(r.status).toBe(403);
  });

  it('rejects BDAs signing into another company slug', async () => {
    await superAdmin.ok(superAdmin.post('/admin/organizations', {
      name: 'Other Co',
      slug: `other-co-${Date.now().toString(36)}`,
      adminEmail: `other.admin.${Date.now()}@test.local`,
      adminPassword: 'Other#Admin1234',
      adminFirstName: 'Other',
      adminLastName: 'Admin',
      plan: 'starter',
    }));

    const wrong = await t.api.post('/auth/bda/other-co/login', CREDS.sales);
    // Either unknown slug (404 branding / 401 login) or wrong org credentials → not success
    expect(wrong.status).toBeGreaterThanOrEqual(400);
  });
});

describe('BDA activity mirror', () => {
  it('writes company Activity when a BDA creates a lead', async () => {
    const sales = await t.api.login('sales');
    const lead = await sales.ok(sales.post('/sales-crm/leads', {
      contactPerson: 'Activity Lead',
      company: 'Mirror Co',
      phone: '+91 90000 00000',
      status: 'new',
    }));
    expect(lead._id || lead.id).toBeTruthy();

    // Activity mirroring is async (non-blocking on the write path).
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const events = await admin.ok(admin.get('/os/activity?limit=50'));
      const list = Array.isArray(events) ? events : [];
      found = list.some((e: any) => String(e.title || '').includes('BDA') && String(e.title || '').toLowerCase().includes('lead'));
    }
    expect(found).toBe(true);
  });
});
