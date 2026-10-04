import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { PLATFORM_ORG_SLUG } from '../shared/constants/platform.js';
import { ROLE_PERMISSIONS } from '../shared/types/index.js';
import { hashPassword } from '../shared/utils/jwt.js';

const PASSWORD = process.argv[2] || 'SuperAdmin@123456';
const EMAILS = ['superadmin@agencyerp.com', 'superadmin@editcomedia.com'];

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const hash = await hashPassword(PASSWORD);
  const org = await Organization.findOne({ slug: PLATFORM_ORG_SLUG });
  if (!org) throw new Error('Platform organization not found');

  for (const email of EMAILS) {
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: { password: hash, role: 'super_admin', isActive: true, permissions: ROLE_PERMISSIONS.super_admin },
        $setOnInsert: { organizationId: org._id, firstName: 'Platform', lastName: 'Admin' },
      },
      { upsert: true, new: true }
    );
    console.log(`ready ${user.email}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
