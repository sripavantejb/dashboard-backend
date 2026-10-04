import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Api, startApp, type TestApp } from './helpers.js';

let t: TestApp;
let admin: Api;

beforeAll(async () => {
  t = await startApp();
  admin = await t.api.login('admin');
});
afterAll(() => t?.close());

describe('BDA pipeline stage targets', () => {
  it('lets company admins set per-BDA daily stage targets', async () => {
    const created = await admin.ok(admin.post('/sales-crm/employees', {
      name: 'Stage Target BDA',
      email: `stage.bda.${Date.now()}@test.local`,
      password: 'Stage#Bda1234',
      department: 'Sales',
      isSalesAdmin: false,
    }));
    const employeeId = String(created._id || created.employee?._id || created.id);
    expect(employeeId).toBeTruthy();

    await admin.ok(admin.put('/sales-crm/stage-targets', {
      employeeId,
      stages: { new: 5, contacted: 3, qualified: 2, converted: 1, unqualified: 0, lost: 0 },
    }));

    const rows = await admin.ok(admin.get('/sales-crm/stage-targets'));
    const row = rows.find((r: any) => r.employeeId === employeeId);
    expect(row.stages).toMatchObject({ new: 5, contacted: 3, qualified: 2, converted: 1 });
    expect(row.actual).toBeTruthy();
  });
});
