/**
 * Consolidate every company's data into the single shared platform database
 * and permanently disable per-company dedicated MongoDB configs.
 *
 *   npx tsx src/scripts/consolidate-to-single-db.ts
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { invalidateOrganizationConnection } from '../config/tenant.js';

async function main() {
  const clusterUri = env.MONGODB_URI.replace(/(\.mongodb\.net)\/[^?]+/, '$1/');
  await mongoose.connect(env.MONGODB_URI);
  const mainDb = mongoose.connection.db!;
  console.log('platformDb', mainDb.databaseName);

  const orgs = await mainDb.collection('organizations').find({}).toArray();
  console.log('organizations', orgs.length);

  for (const org of orgs) {
    const enabled = Boolean(org.database?.enabled);
    const tenantName = org.database?.dbName || '';
    console.log(`\n→ ${org.slug} enabled=${enabled} tenantDb=${tenantName || '—'}`);

    if (enabled && tenantName && tenantName !== mainDb.databaseName) {
      const tenant = await mongoose.createConnection(clusterUri, { dbName: tenantName }).asPromise();
      const collections = await tenant.db!.listCollections().toArray();
      let copied = 0;
      let skipped = 0;
      for (const { name } of collections) {
        if (name.startsWith('system.')) continue;
        const docs = await tenant.db!.collection(name).find({ organizationId: org._id }).toArray();
        if (!docs.length) continue;
        for (const doc of docs) {
          try {
            await mainDb.collection(name).updateOne(
              { _id: doc._id },
              { $set: { ...doc, organizationId: org._id } },
              { upsert: true },
            );
            copied += 1;
          } catch (err) {
            // Unique-index clashes (e.g. salesemployees already on platform) — keep existing.
            skipped += 1;
            if (!(err instanceof Error) || !/E11000/.test(err.message)) {
              console.warn(`  warn ${name}:`, err instanceof Error ? err.message : err);
            }
          }
        }
        console.log(`  ${name}: ${docs.length} docs`);
      }
      console.log(`  copied=${copied} skippedDuplicates=${skipped}`);
      await tenant.close();
    }

    await mainDb.collection('organizations').updateOne(
      { _id: org._id },
      {
        $set: {
          'database.enabled': false,
          'database.status': 'unconfigured',
          'database.hint': '',
          'database.dbName': '',
          'database.lastError': '',
          'database.updatedBy': 'consolidate-to-single-db',
          'database.lastCheckedAt': new Date(),
        },
        $unset: {
          'database.uriCipher': '',
          'database.uriIv': '',
          'database.uriTag': '',
        },
      },
    );
    await invalidateOrganizationConnection(String(org._id));
    console.log(`  database config cleared → shared ${mainDb.databaseName}`);
  }

  // Verify Editco finance on platform
  const editco = orgs.find((o) => o.slug === 'editco' || o.slug === 'editco-media');
  if (editco) {
    const tx = await mainDb.collection('transactions').countDocuments({ organizationId: editco._id });
    const mr = await mainDb.collection('manualrevenues').countDocuments({ organizationId: editco._id });
    const vendors = await mainDb.collection('vendors').countDocuments({ organizationId: editco._id });
    const creds = await mainDb.collection('productcredentials').countDocuments({ organizationId: editco._id });
    console.log('\nEDITCO_PLATFORM_VERIFY', { tx, mr, vendors, creds });
  }

  await mongoose.disconnect();
  console.log('\nDone. All orgs use the single shared database:', mainDb.databaseName);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
