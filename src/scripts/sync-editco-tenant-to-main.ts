/**
 * Copy Editco Media business data from tenant DB (editco_media) → main DB (editco_platform)
 * so production still sees it when tenant URI decrypt fails.
 *
 *   npx tsx src/scripts/sync-editco-tenant-to-main.ts
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const COLLECTIONS = [
  'transactions',
  'manualrevenues',
  'recurringpayments',
  'productcredentials',
  'vendors',
  'conversions',
  'companies',
  'contacts',
  'projects',
  'invoices',
  'payments',
  'salesemployees',
  'salesleads',
  'salesdeals',
  'salescalls',
  'salesfollowups',
  'salesactivities',
  'salesstagetargets',
  'salestargets',
  'activityevents',
];

async function main() {
  const clusterUri = env.MONGODB_URI.replace(/(\.mongodb\.net)\/[^?]+/, '$1/');
  await mongoose.connect(env.MONGODB_URI);
  const org = await mongoose.connection.db!.collection('organizations').findOne({ slug: 'editco' });
  if (!org) throw new Error('Editco org not found');
  const orgId = org._id;
  console.log('org', String(orgId), 'tenantDb', org.database?.dbName, 'enabled', org.database?.enabled);

  const tenant = await mongoose.createConnection(clusterUri, { dbName: 'editco_media' }).asPromise();
  const main = mongoose.connection;

  const summary: Record<string, { source: number; upserted: number; matched: number }> = {};

  for (const name of COLLECTIONS) {
    const srcCols = await tenant.db!.listCollections({ name }).toArray();
    if (!srcCols.length) {
      summary[name] = { source: 0, upserted: 0, matched: 0 };
      continue;
    }
    const docs = await tenant.db!.collection(name).find({ organizationId: orgId }).toArray();
    let upserted = 0;
    let matched = 0;
    for (const doc of docs) {
      const { _id, ...rest } = doc;
      const res = await main.db!.collection(name).updateOne(
        { _id },
        { $set: { ...rest, organizationId: orgId } },
        { upsert: true },
      );
      if (res.upsertedCount) upserted += 1;
      else matched += 1;
    }
    summary[name] = { source: docs.length, upserted, matched };
    console.log(name, summary[name]);
  }

  // Verify main now has finance rows
  const tx = await main.db!.collection('transactions').countDocuments({ organizationId: orgId });
  const mr = await main.db!.collection('manualrevenues').countDocuments({ organizationId: orgId });
  const vendors = await main.db!.collection('vendors').countDocuments({ organizationId: orgId });
  const creds = await main.db!.collection('productcredentials').countDocuments({ organizationId: orgId });
  console.log('MAIN_VERIFY', { tx, mr, vendors, creds });

  await tenant.close();
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
