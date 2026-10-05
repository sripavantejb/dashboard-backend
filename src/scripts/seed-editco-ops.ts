/**
 * Seed / repair Editco Media credentials, clients, recurring payment, and ledger.
 *
 *   npx tsx src/scripts/seed-editco-ops.ts
 *   npx tsx src/scripts/seed-editco-ops.ts --dry-run
 */
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { runWithOrganization } from '../config/tenant.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import {
  Conversion,
  ManualRevenue,
  ProductCredential,
  RecurringPayment,
  Transaction,
  Vendor,
} from '../models/index.js';
import { encryptSecret, decryptSecret } from '../shared/utils/crypto.js';
import { resolveCompanyAndContact } from '../features/os/services/conversion.service.js';

const DRY = process.argv.includes('--dry-run');

type CredSeed = {
  productName: string;
  category: string;
  username: string;
  password: string;
  notes?: string;
  url?: string;
};

type ClientSeed = {
  companyName: string;
  contactPerson: string;
  location: string;
  activeStatus: 'active' | 'inactive' | 'working_on_project';
  publicCode: string;
  owner?: string;
};

const CREDENTIALS: CredSeed[] = [
  {
    productName: 'Cubic CMS',
    category: 'client, Interior design',
    username: 'superadmin@cubic.com',
    password: 'cubic@editco',
    notes: 'Company: Cubic Associates Workspace: cubicassociates Role: Admin Email: superadmin@cubic.com Password: cubic@editco Primary POC : Harsha , Tej , Lokesh',
  },
  {
    productName: 'NWspark',
    category: 'Cloud Hetzner',
    username: 'editcomediaofficial@gmail.com',
    password: 'Editco@spark3',
  },
  {
    productName: 'Onboarding Application',
    category: 'Internal , Employee purpose',
    username: 'deepikamundla54@gmail.com , harshapolina1@gmail.com, bsripavantej@gmail.com',
    password: 'abc@123',
    notes: 'This gives employee creds when we register an employee for any KT can ask Deepika',
  },
  {
    productName: 'PMS Cubic Platform admin',
    category: 'Platform admin',
    username: 'editcomediaofficial@gmail.com',
    password: 'editcomedia@THD',
  },
  {
    productName: 'Pixel Graphix website',
    category: 'Client Project',
    username: 'admin@pixelgraphix.com',
    password: 'pixelgraphix123',
    notes: 'this is a clients project where we implemented cms and careers page , contact Deepika for any queries',
  },
];

const CLIENTS: ClientSeed[] = [
  { companyName: 'virtue dental clinic', contactPerson: 'Dr.Abhishek', location: 'Gowlidoddy', activeStatus: 'inactive', publicCode: 'EC-2026-4D6DD2D1' },
  { companyName: 'AVM', contactPerson: "Deepika's Cousin", location: 'Chennai', activeStatus: 'active', publicCode: 'EC-2026-2BA37073' },
  { companyName: 'kreugar international Furniture', contactPerson: 'Diyansh Referal (Dinkar )', location: 'Banglore', activeStatus: 'active', publicCode: 'EC-2026-DAF942E4' },
  { companyName: 'NW', contactPerson: 'Porus SPARK', location: 'Hydrebad', activeStatus: 'active', publicCode: 'EC-2026-D9DDA3E8' },
  { companyName: 'Sales', contactPerson: "Lokesh Harsha's Cousin", location: 'Hydrebad', activeStatus: 'active', publicCode: 'EC-2026-9280A02B' },
  { companyName: 'Qualitest', contactPerson: 'Ravi / wife', location: 'Hydrebad', activeStatus: 'inactive', publicCode: 'EC-2026-067D45B2' },
  { companyName: "sai Preethi's skin and aesthetic clinic", contactPerson: 'Yurek raj', location: 'Adayar, chennai', activeStatus: 'active', publicCode: 'EC-2026-F9D10162' },
  { companyName: 'Social DNA', contactPerson: 'Adithya', location: 'Hydrebad, Madhapur', activeStatus: 'inactive', publicCode: 'EC-2026-7F8BFE6B' },
  { companyName: 'kodeclamp', contactPerson: 'Suvam', location: 'Noida', activeStatus: 'active', publicCode: 'EC-2026-03718FF2' },
  { companyName: 'Dentin clinic', contactPerson: 'Dr.Surya', location: 'Gowlidoddy', activeStatus: 'working_on_project', publicCode: 'EC-2026-EABA21CB' },
];

async function resolveActor(organizationId: mongoose.Types.ObjectId) {
  const preferred = await User.findOne({
    organizationId,
    email: /deepikamundla54/i,
    isActive: true,
  }).select('email firstName lastName').lean();
  if (preferred) {
    return {
      email: preferred.email,
      name: `${preferred.firstName || ''} ${preferred.lastName || ''}`.trim() || preferred.email,
      userId: String(preferred._id),
      organizationId: String(organizationId),
    };
  }
  const admin = await User.findOne({
    organizationId,
    role: { $in: ['admin', 'super_admin'] },
    isActive: true,
  }).select('email firstName lastName').lean();
  if (!admin) throw new Error('No active admin for Editco Media');
  return {
    email: admin.email,
    name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email,
    userId: String(admin._id),
    organizationId: String(organizationId),
  };
}

async function seedCredentials(orgId: mongoose.Types.ObjectId, actorEmail: string) {
  let created = 0;
  let updated = 0;
  let ok = 0;
  for (const row of CREDENTIALS) {
    const existing = await ProductCredential.findOne({
      organizationId: orgId,
      productName: row.productName,
      recordStatus: 'active',
    });
    const enc = encryptSecret(row.password);
    if (!enc) throw new Error(`Could not encrypt password for ${row.productName}`);

    if (existing) {
      const current = decryptSecret({
        cipher: existing.passwordCipher,
        iv: existing.passwordIv,
        tag: existing.passwordTag,
      });
      const needsUpdate =
        current !== row.password
        || existing.username !== row.username
        || (row.notes && existing.notes !== row.notes)
        || existing.category !== row.category;

      if (!needsUpdate) {
        ok += 1;
        console.log(`cred ok     ${row.productName}`);
        continue;
      }
      if (DRY) {
        console.log(`cred would update ${row.productName}`);
        updated += 1;
        continue;
      }
      existing.username = row.username;
      existing.category = row.category;
      existing.notes = row.notes || existing.notes || '';
      if (row.url) existing.url = row.url;
      existing.passwordCipher = enc.cipher;
      existing.passwordIv = enc.iv;
      existing.passwordTag = enc.tag;
      existing.updatedBy = actorEmail;
      await existing.save();
      updated += 1;
      console.log(`cred updated ${row.productName}`);
      continue;
    }

    if (DRY) {
      console.log(`cred would create ${row.productName}`);
      created += 1;
      continue;
    }
    await ProductCredential.create({
      organizationId: orgId,
      productName: row.productName,
      category: row.category,
      username: row.username,
      url: row.url || '',
      notes: row.notes || '',
      passwordCipher: enc.cipher,
      passwordIv: enc.iv,
      passwordTag: enc.tag,
      createdBy: actorEmail,
      updatedBy: actorEmail,
      recordStatus: 'active',
    });
    created += 1;
    console.log(`cred created ${row.productName}`);
  }
  return { created, updated, ok };
}

async function seedClients(orgId: mongoose.Types.ObjectId, actor: { email: string; name: string; userId: string; organizationId: string }) {
  let created = 0;
  let updated = 0;
  let ok = 0;

  for (const row of CLIENTS) {
    const byCode = await Conversion.findOne({
      organizationId: orgId,
      publicCode: row.publicCode.toUpperCase(),
      recordStatus: 'active',
    }).lean();
    const byName = await Vendor.findOne({
      organizationId: orgId,
      companyName: new RegExp(`^${row.companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      recordStatus: 'active',
    });

    if (byCode || byName) {
      const vendor = byName || (byCode
        ? await Vendor.findOne({ organizationId: orgId, conversionUuid: byCode.conversionUuid, recordStatus: 'active' })
        : null);
      if (!vendor) {
        console.log(`client orphan conversion ${row.publicCode}`);
        continue;
      }
      const needs =
        vendor.contactPerson !== row.contactPerson
        || vendor.location !== row.location
        || vendor.activeStatus !== row.activeStatus
        || vendor.accountOwner !== (row.owner || 'superadmin');
      if (!needs) {
        ok += 1;
        console.log(`client ok   ${row.companyName} (${row.publicCode})`);
        continue;
      }
      if (DRY) {
        console.log(`client would update ${row.companyName}`);
        updated += 1;
        continue;
      }
      vendor.contactPerson = row.contactPerson;
      vendor.location = row.location;
      vendor.activeStatus = row.activeStatus;
      vendor.accountOwner = row.owner || 'superadmin';
      vendor.updatedBy = actor.email;
      await vendor.save();
      if (byCode) {
        await Conversion.updateOne(
          { _id: byCode._id },
          { $set: { owner: row.owner || 'superadmin', updatedBy: actor.email } },
        );
      }
      updated += 1;
      console.log(`client updated ${row.companyName}`);
      continue;
    }

    if (DRY) {
      console.log(`client would create ${row.companyName} (${row.publicCode})`);
      created += 1;
      continue;
    }

    const conversionUuid = randomUUID();
    const conversion = await Conversion.create({
      organizationId: orgId,
      conversionUuid,
      publicCode: row.publicCode.toUpperCase(),
      conversionValue: 0,
      services: [],
      owner: row.owner || 'superadmin',
      ownerId: actor.userId,
      origin: 'direct_client',
      createdBy: actor.email,
      updatedBy: actor.email,
      recordStatus: 'active',
    });
    const { companyId, contactId } = await resolveCompanyAndContact(actor as never, {
      companyName: row.companyName,
      contactPerson: row.contactPerson,
    });
    const vendor = await Vendor.create({
      organizationId: orgId,
      conversionUuid,
      conversionId: conversion._id,
      companyId,
      primaryContactId: contactId,
      companyName: row.companyName,
      contactPerson: row.contactPerson,
      location: row.location,
      activeStatus: row.activeStatus,
      accountOwner: row.owner || 'superadmin',
      source: 'direct',
      createdBy: actor.email,
      updatedBy: actor.email,
      recordStatus: 'active',
    });
    await Conversion.updateOne({ _id: conversion._id }, { $set: { vendorId: vendor._id } });
    created += 1;
    console.log(`client created ${row.companyName} (${row.publicCode})`);
  }
  return { created, updated, ok };
}

async function seedRecurring(orgId: mongoose.Types.ObjectId, actorEmail: string) {
  const existing = await RecurringPayment.findOne({
    organizationId: orgId,
    title: /sai preethi/i,
    recordStatus: 'active',
  });
  if (existing) {
    console.log(`recurring ok Sai Preethi ₹${existing.amount}`);
    return { created: 0, ok: 1 };
  }
  if (DRY) {
    console.log('recurring would create Sai Preethi ₹10000');
    return { created: 1, ok: 0 };
  }
  await RecurringPayment.create({
    organizationId: orgId,
    title: 'Sai Preethi',
    payee: 'Deepika',
    amount: 10000,
    frequency: 'monthly',
    nextDueAt: new Date('2026-09-15T00:00:00.000Z'),
    status: 'active',
    notes: 'Monthly payment',
    createdBy: actorEmail,
    updatedBy: actorEmail,
    recordStatus: 'active',
  });
  console.log('recurring created Sai Preethi ₹10000');
  return { created: 1, ok: 0 };
}

async function verifyLedger(orgId: mongoose.Types.ObjectId) {
  const [tx, mr, creds, vendors, recurring] = await Promise.all([
    Transaction.find({ organizationId: orgId, recordStatus: 'active' }).lean(),
    ManualRevenue.find({ organizationId: orgId, recordStatus: 'active' }).lean(),
    ProductCredential.find({ organizationId: orgId, recordStatus: 'active' }).lean(),
    Vendor.find({ organizationId: orgId, recordStatus: 'active' }).lean(),
    RecurringPayment.find({ organizationId: orgId, recordStatus: 'active' }).lean(),
  ]);
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
    + mr.reduce((s, m) => s + Number(m.amount || 0), 0);
  const spent = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  let revealable = 0;
  for (const c of creds) {
    if (decryptSecret({ cipher: c.passwordCipher, iv: c.passwordIv, tag: c.passwordTag })) revealable += 1;
  }
  return {
    transactions: tx.length,
    manualRevenue: mr.length,
    income,
    spent,
    net: income - spent,
    credentials: creds.length,
    credentialsRevealable: revealable,
    clients: vendors.length,
    recurring: recurring.length,
  };
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const org = await Organization.findOne({
    $or: [{ slug: 'editco' }, { slug: 'editco-media' }, { name: /editco media/i }],
  });
  if (!org) throw new Error('Editco Media organization not found');

  const actor = await resolveActor(org._id as mongoose.Types.ObjectId);
  console.log(`Org=${org.slug} actor=${actor.email} dryRun=${DRY}`);

  await runWithOrganization(String(org._id), async () => {
    const creds = await seedCredentials(org._id as mongoose.Types.ObjectId, actor.email);
    const clients = await seedClients(org._id as mongoose.Types.ObjectId, actor);
    const recurring = await seedRecurring(org._id as mongoose.Types.ObjectId, actor.email);
    const totals = await verifyLedger(org._id as mongoose.Types.ObjectId);
    console.log({ creds, clients, recurring, totals });
  });

  // Production may fail to decrypt the tenant URI and fall back to editco_platform.
  // Mirror critical collections so dashboards.editcomedia.com still sees the seed.
  if (!DRY) {
    const { spawnSync } = await import('node:child_process');
    const mirrored = spawnSync('npx', ['tsx', 'src/scripts/sync-editco-tenant-to-main.ts'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (mirrored.status !== 0) {
      console.warn('Tenant→main sync failed — production may still show empty until sync succeeds');
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
