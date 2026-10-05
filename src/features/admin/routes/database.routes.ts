import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Organization } from '../../../models/Organization.js';
import { route, parseBody, isObjectId } from '../../../shared/utils/crud.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { maskMongoUri } from '../../../shared/utils/crypto.js';
import { databaseUsage, forgetUsage } from '../services/usage.service.js';
import { invalidateOrganizationConnection, testMongoConnection } from '../../../config/tenant.js';

/**
 * Mounted under `/admin/organizations/:id/database` — platform super_admin only.
 * Single-database mode: every company uses the shared platform MongoDB. Connecting a
 * dedicated per-company database is disabled.
 */
export const organizationDatabaseRoutes = Router({ mergeParams: true });

const uriSchema = z.object({
  uri: z.string().trim().regex(/^mongodb(\+srv)?:\/\//, 'Must be a mongodb:// or mongodb+srv:// connection string'),
  dbName: z.string().trim().regex(/^[A-Za-z0-9_-]{1,63}$/, 'Database name may only contain letters, numbers, - and _').optional().or(z.literal('')),
});

async function loadOrg(id: string) {
  if (!isObjectId(id)) throw new NotFoundError('Organization');
  const org = await Organization.findById(id).select('name slug database');
  if (!org) throw new NotFoundError('Organization');
  return org;
}

function publicDatabase(org: { _id: unknown; database?: Record<string, unknown> }) {
  // Dedicated DBs are disabled — always report shared platform mode.
  void org.database;
  return {
    enabled: false,
    dbName: '',
    hint: '',
    status: 'unconfigured' as const,
    lastCheckedAt: null,
    lastError: '',
    runtime: 'shared' as const,
  };
}

async function probe(uri: string, dbName?: string) {
  try {
    return await testMongoConnection(uri, dbName || undefined);
  } catch (error) {
    const message = (error as Error).message || 'Connection failed';
    // Never echo credentials back from driver errors.
    throw new ValidationError(`Could not connect: ${message.replace(/\/\/[^@\s]+@/g, '//****@')}`);
  }
}

organizationDatabaseRoutes.get(
  '/',
  route(async (req) => publicDatabase((await loadOrg(req.params.id as string)).toObject()))
);

organizationDatabaseRoutes.get(
  '/usage',
  route(async (req) => {
    const org = await loadOrg(req.params.id as string);
    try {
      return await databaseUsage(String(org._id), req.query.fresh === '1');
    } catch {
      throw new ValidationError('Could not reach this company\'s database to measure usage');
    }
  })
);

organizationDatabaseRoutes.post(
  '/test',
  route(async (req) => {
    const org = await loadOrg(req.params.id as string);
    const body = parseBody<z.infer<typeof uriSchema>>(uriSchema, req.body);
    const result = await probe(body.uri, body.dbName || org.slug);
    return { ...result, hint: maskMongoUri(body.uri) };
  })
);

organizationDatabaseRoutes.put(
  '/',
  route(async () => {
    throw new ValidationError(
      'Dedicated per-company databases are disabled. All companies use the single shared platform database.'
    );
  })
);

organizationDatabaseRoutes.post(
  '/check',
  route(async (req) => {
    const org = await loadOrg(req.params.id as string);
    // Single-DB mode — ping the shared platform connection.
    try {
      await mongoose.connection.db!.admin().ping();
    } catch (error) {
      throw new ValidationError(
        `Shared database unreachable: ${((error as Error).message || 'Connection failed').replace(/\/\/[^@\s]+@/g, '//****@')}`
      );
    }
    forgetUsage(String(org._id));
    return publicDatabase(org.toObject());
  })
);

organizationDatabaseRoutes.delete(
  '/',
  route(async (req) => {
    const org = await loadOrg(req.params.id as string);
    await Organization.updateOne(
      { _id: org._id },
      {
        $set: { 'database.enabled': false, 'database.status': 'unconfigured', 'database.hint': '', 'database.lastError': '', 'database.updatedBy': req.user!.email },
        $unset: { 'database.uriCipher': 1, 'database.uriIv': 1, 'database.uriTag': 1 },
      }
    );
    await invalidateOrganizationConnection(String(org._id));
    forgetUsage(String(org._id));
    return publicDatabase((await loadOrg(String(org._id))).toObject());
  })
);
