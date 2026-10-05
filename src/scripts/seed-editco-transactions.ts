/**
 * Seed Editco Media Sept 2026 ledger (income / spent / manual revenue).
 *
 *   npx tsx src/scripts/seed-editco-transactions.ts
 *   npx tsx src/scripts/seed-editco-transactions.ts --dry-run
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { runWithOrganization } from '../config/tenant.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { ManualRevenue, Transaction } from '../models/index.js';

const DRY = process.argv.includes('--dry-run');
const ACTOR_HINT = 'deepikamundla54';

type TxSeed = {
  type: 'income' | 'expense';
  title: string;
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD (IST calendar day)
  party?: string;
  paymentMethod?: 'upi' | 'bank_transfer' | 'cash' | 'card' | 'cheque' | 'other';
  notes?: string;
  history?: Array<{
    action: 'created' | 'updated' | 'deleted';
    changes?: Array<{ field: string; from: string; to: string }>;
    at: string;
  }>;
};

type ManualSeed = {
  source: string;
  description?: string;
  amount: number;
  receivedAt: string;
  notes?: string;
};

/** IST noon so the calendar day survives UTC storage. */
function istDay(isoDate: string, hour = 12, minute = 0) {
  return new Date(`${isoDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`);
}

const TRANSACTIONS: TxSeed[] = [
  {
    type: 'income',
    title: 'Suvam - cybernanet II payment',
    category: 'Client payment',
    amount: 4000,
    date: '2026-09-26',
    party: 'Suvam',
    paymentMethod: 'upi',
    notes: 'To Deepika',
    history: [{ action: 'created', at: '2026-09-26T13:24:00+05:30' }],
  },
  {
    type: 'expense',
    title: 'Rajini Kreugar Food RM',
    category: 'Client payment',
    amount: 680,
    date: '2026-09-26',
    party: 'Rajini',
    paymentMethod: 'upi',
    history: [{ action: 'created', at: '2026-09-26T13:30:00+05:30' }],
  },
  {
    type: 'income',
    title: 'Sai Preethi (Monthly payment)',
    category: 'Client payment',
    amount: 10000,
    date: '2026-09-24',
    party: 'Yurek',
    paymentMethod: 'upi',
    notes: 'to deepika',
    history: [{ action: 'created', at: '2026-09-26T13:23:00+05:30' }],
  },
  {
    type: 'expense',
    title: 'Gift Internal',
    category: 'Internal , Employee purpose',
    amount: 5500,
    date: '2026-09-18',
    paymentMethod: 'upi',
    history: [{ action: 'created', at: '2026-09-26T13:23:00+05:30' }],
  },
  {
    type: 'expense',
    title: 'Deepika Coorg RM',
    category: 'Internal , Employee purpose',
    amount: 5000,
    date: '2026-09-02',
    party: 'Deepika',
    paymentMethod: 'upi',
    history: [{ action: 'created', at: '2026-09-26T13:27:00+05:30' }],
  },
  {
    type: 'expense',
    title: 'Harsha Coorg RM',
    category: 'Internal , Employee purpose',
    amount: 3000,
    date: '2026-09-02',
    party: 'Harsha',
    paymentMethod: 'upi',
    history: [
      { action: 'created', at: '2026-09-26T13:28:00+05:30' },
      {
        action: 'updated',
        at: '2026-09-26T13:28:30+05:30',
        changes: [{ field: 'Paid to / received from', from: 'Tej', to: 'Harsha' }],
      },
    ],
  },
  {
    type: 'expense',
    title: 'Tej Coorg RM',
    category: 'Internal , Employee purpose',
    amount: 1500,
    date: '2026-09-02',
    party: 'Tej',
    paymentMethod: 'upi',
    history: [{ action: 'created', at: '2026-09-26T13:29:00+05:30' }],
  },
];

const MANUAL: ManualSeed[] = [
  {
    source: 'Kreugar',
    description: 'This is the reiumbiesment',
    amount: 8008,
    receivedAt: '2026-09-08',
  },
  {
    source: 'Suvam',
    description: 'Cybernanet website costs for 8000',
    amount: 4000,
    receivedAt: '2026-09-06',
  },
  {
    source: 'Nxtwave',
    amount: 38000,
    receivedAt: '2026-09-04',
  },
];

async function resolveActor(organizationId: mongoose.Types.ObjectId) {
  const preferred = await User.findOne({
    organizationId,
    email: new RegExp(ACTOR_HINT, 'i'),
  }).select('email').lean();
  if (preferred?.email) return preferred.email;

  const admin = await User.findOne({
    organizationId,
    role: { $in: ['admin', 'super_admin'] },
    isActive: true,
  }).select('email').lean();
  if (admin?.email) return admin.email;

  throw new Error('No admin user found for Editco Media to attribute ledger rows');
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const org = await Organization.findOne({
    $or: [{ slug: 'editco-media' }, { slug: 'editco' }, { name: /editco media/i }],
  });
  if (!org) throw new Error('Editco Media organization not found');

  const actorEmail = await resolveActor(org._id as mongoose.Types.ObjectId);
  console.log(`Org=${org.slug} actor=${actorEmail} dryRun=${DRY}`);

  await runWithOrganization(String(org._id), async () => {
    let txCreated = 0;
    let txSkipped = 0;
    let mrCreated = 0;
    let mrSkipped = 0;

    for (const row of TRANSACTIONS) {
      const date = istDay(row.date);
      const existing = await Transaction.findOne({
        organizationId: org._id,
        recordStatus: 'active',
        type: row.type,
        title: row.title,
        amount: row.amount,
      });
      if (existing) {
        txSkipped += 1;
        console.log(`skip tx  ${row.type} ${row.title} ₹${row.amount}`);
        continue;
      }
      const history = (row.history || [{ action: 'created' as const, at: date.toISOString() }]).map((h) => ({
        action: h.action,
        changes: h.changes || [],
        by: actorEmail,
        at: new Date(h.at),
      }));
      if (DRY) {
        console.log(`would create tx  ${row.type} ${row.title} ₹${row.amount}`);
        txCreated += 1;
        continue;
      }
      await Transaction.create({
        organizationId: org._id,
        type: row.type,
        title: row.title,
        category: row.category,
        amount: row.amount,
        date,
        party: row.party || '',
        paymentMethod: row.paymentMethod || 'upi',
        notes: row.notes || '',
        reference: '',
        history,
        createdBy: actorEmail,
        updatedBy: actorEmail,
        recordStatus: 'active',
      });
      txCreated += 1;
      console.log(`created tx  ${row.type} ${row.title} ₹${row.amount}`);
    }

    for (const row of MANUAL) {
      const receivedAt = istDay(row.receivedAt);
      const existing = await ManualRevenue.findOne({
        organizationId: org._id,
        recordStatus: 'active',
        source: row.source,
        amount: row.amount,
      });
      if (existing) {
        mrSkipped += 1;
        console.log(`skip mr  ${row.source} ₹${row.amount}`);
        continue;
      }
      if (DRY) {
        console.log(`would create mr  ${row.source} ₹${row.amount}`);
        mrCreated += 1;
        continue;
      }
      await ManualRevenue.create({
        organizationId: org._id,
        source: row.source,
        description: row.description || '',
        amount: row.amount,
        receivedAt,
        notes: row.notes || row.description || '',
        paymentMethod: '',
        reference: '',
        history: [{ action: 'created', changes: [], by: actorEmail, at: receivedAt }],
        createdBy: actorEmail,
        updatedBy: actorEmail,
        recordStatus: 'active',
      });
      mrCreated += 1;
      console.log(`created mr  ${row.source} ₹${row.amount}`);
    }

    const [tx, mr] = await Promise.all([
      Transaction.find({ organizationId: org._id, recordStatus: 'active' }).select('type amount').lean(),
      ManualRevenue.find({ organizationId: org._id, recordStatus: 'active' }).select('amount').lean(),
    ]);
    const ledgerIn = tx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const manualIn = mr.reduce((s, m) => s + Number(m.amount || 0), 0);
    const spent = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
    const income = ledgerIn + manualIn;

    console.log({
      txCreated,
      txSkipped,
      mrCreated,
      mrSkipped,
      totals: {
        income,
        spent,
        net: income - spent,
        ledgerIn,
        manualRevenueIn: manualIn,
        entries: tx.length + mr.length,
      },
    });
  });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
