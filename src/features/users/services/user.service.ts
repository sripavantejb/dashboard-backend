import { Types } from 'mongoose';
import { User, Organization } from '../../../models/index.js';
import { hashPassword } from '../../../shared/utils/jwt.js';
import { ConflictError, NotFoundError, ForbiddenError } from '../../../shared/errors/index.js';
import { ROLE_PERMISSIONS } from '../../../shared/types/index.js';
import type { UserRole } from '../../../shared/types/index.js';
import { paginate, buildSearchFilter } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class UserService {
  async create(organizationId: string, data: Record<string, unknown>) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new NotFoundError('Organization');

    const currentUsers = await User.countDocuments({ organizationId, isActive: true });
    if (currentUsers >= org.maxUsers) {
      throw new ForbiddenError(`User limit reached for ${org.subscriptionPlan} plan (${org.maxUsers} users). Upgrade your plan.`);
    }

    const email = (data.email as string).toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) throw new ConflictError('Email already registered');

    const role = (data.role as UserRole) || 'sales';
    return User.create({
      organizationId,
      email,
      password: await hashPassword(data.password as string),
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role,
      department: data.department,
      permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.sales,
    });
  }

  async findAll(organizationId: string, query: PaginationQuery & { role?: string }) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      isActive: true,
      ...buildSearchFilter(query.search, ['firstName', 'lastName', 'email']),
    };
    if (query.role) filter.role = query.role;
    return paginate(User, filter, query);
  }

  async update(organizationId: string, id: string, data: Record<string, unknown>) {
    const updates = { ...data };
    delete updates.password;
    delete updates.email;

    if (data.role) {
      updates.permissions = ROLE_PERMISSIONS[data.role as UserRole];
    }

    const user = await User.findOneAndUpdate({ _id: id, organizationId }, updates, { new: true });
    if (!user) throw new NotFoundError('User');
    return {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department,
      phone: user.phone,
      isActive: user.isActive,
    };
  }

  async deactivate(organizationId: string, id: string) {
    const user = await User.findOneAndUpdate(
      { _id: id, organizationId },
      { isActive: false },
      { new: true }
    );
    if (!user) throw new NotFoundError('User');
    return user;
  }
}

export const userService = new UserService();
