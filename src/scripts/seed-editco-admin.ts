import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { ROLE_PERMISSIONS } from '../shared/types/index.js';
import { hashPassword } from '../shared/utils/jwt.js';
import { runWithOrganization } from '../config/tenant.js';
import { ensureSalesEmployeeForUser } from '../features/os/services/sales-employee.service.js';
import { SalesEmployee } from '../models/index.js';

const EMAIL = (process.argv[2] || 'sripavantejb@gmail.com').toLowerCase();
const PASSWORD = process.argv[3] || 'editcomedia@tej';
async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const org = await Organization.findOne({
    $or: [{ slug: 'editco' }, { slug: 'editco-media' }, { name: /editco media/i }],
  });
  if (!org) throw new Error('Editco Media organization not found');

  const hash = await hashPassword(PASSWORD);
  const user = await User.findOneAndUpdate(
    { email: EMAIL },
    {
      $set: {
        organizationId: org._id,
        password: hash,
        role: 'admin',
        permissions: ROLE_PERMISSIONS.admin,
        isActive: true,
      },
      $setOnInsert: {
        firstName: 'Tej',
        lastName: 'Balam',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await runWithOrganization(String(org._id), async () => {
    const existing = await SalesEmployee.findOne({ organizationId: org._id, userId: user._id });
    if (existing) {
      existing.isSalesAdmin = true;
      existing.status = 'active';
      existing.recordStatus = 'active';
      existing.updatedBy = EMAIL;
      await existing.save();
    } else {
      await ensureSalesEmployeeForUser({
        organizationId: String(org._id),
        userId: String(user._id),
        email: EMAIL,
        isSalesAdmin: true,
      });
    }
  });

  console.log(`Admin ready: ${user.email} org=${org.slug} role=${user.role}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
