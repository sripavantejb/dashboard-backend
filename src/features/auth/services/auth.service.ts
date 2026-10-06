import { User, Organization, RefreshToken, RegistrationInvite, SalesEmployee, getPlatformSettings } from '../../../models/index.js';
import { env } from '../../../config/env.js';
import { runWithOrganization } from '../../../config/tenant.js';
import { hashPassword, comparePassword, signAccessToken, signRefreshToken, durationToMs } from '../../../shared/utils/jwt.js';
import { ConflictError, UnauthorizedError, NotFoundError, ForbiddenError } from '../../../shared/errors/index.js';
import { permissionsForRole } from '../../../shared/types/index.js';
import type { UserRole } from '../../../shared/types/index.js';
import { getMaxUsersForPlan } from '../../../shared/constants/plans.js';
import { normalizeOrgSlug } from '../../../shared/constants/slugs.js';

function slugify(text: string): string {
  return normalizeOrgSlug(text);
}

async function isBdaOnlySalesUser(organizationId: string, userId: string, role: string): Promise<boolean> {
  if (role !== 'sales') return false;
  const employee = await runWithOrganization(organizationId, () =>
    SalesEmployee.findOne({ organizationId, userId, recordStatus: { $ne: 'archived' } }).select('isSalesAdmin').lean()
  );
  // No SalesEmployee yet → treat as BDA (provisioned on first portal hit).
  if (!employee) return true;
  return !employee.isSalesAdmin;
}

export class AuthService {
  async getPublicSettings() {
    const settings = await getPlatformSettings();
    return {
      allowPublicRegistration: settings.allowPublicRegistration,
      inviteOnlyMode: settings.inviteOnlyMode,
    };
  }

  async validateInvite(token: string) {
    const invite = await RegistrationInvite.findOne({ token, usedAt: { $exists: false } });
    if (!invite) throw new NotFoundError('Invite');
    if (invite.expiresAt < new Date()) throw new ForbiddenError('Invite has expired');

    return {
      email: invite.email,
      organizationName: invite.organizationName,
      plan: invite.plan,
    };
  }

  async register(data: {
    organizationName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    inviteToken?: string;
  }) {
    const settings = await getPlatformSettings();
    let invite: InstanceType<typeof RegistrationInvite> | null = null;

    if (data.inviteToken) {
      invite = await RegistrationInvite.findOne({ token: data.inviteToken, usedAt: { $exists: false } });
      if (!invite) throw new ForbiddenError('Invalid invite token');
      if (invite.expiresAt < new Date()) throw new ForbiddenError('Invite has expired');
      if (invite.email && invite.email !== data.email.toLowerCase()) {
        throw new ForbiddenError('This invite is for a different email address');
      }
    } else if (settings.inviteOnlyMode || !settings.allowPublicRegistration) {
      throw new ForbiddenError('Registration is invite-only. Please use an invite link from your administrator.');
    }

    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) throw new ConflictError('Email already registered');

    let slug = slugify(data.organizationName);
    const slugExists = await Organization.findOne({ slug });
    if (slugExists) slug = `${slug}-${Date.now()}`;

    const plan = invite?.plan || 'starter';
    const planExpiresAt = new Date();
    planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);

    const organization = await Organization.create({
      name: data.organizationName,
      slug,
      subscriptionPlan: plan,
      maxUsers: getMaxUsersForPlan(plan),
      planStartedAt: new Date(),
      planExpiresAt,
    });

    const hashedPassword = await hashPassword(data.password);
    const user = await User.create({
      organizationId: organization._id,
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'admin' as UserRole,
      permissions: [],
    });

    if (invite) {
      invite.usedAt = new Date();
      invite.usedBy = user._id;
      await invite.save();
    }

    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), organization: this.sessionOrganization(organization), ...tokens };
  }

  async getBdaBranding(orgSlug: string) {
    const slug = normalizeOrgSlug(orgSlug);
    const org = await Organization.findOne({ slug, isActive: true }).select('name slug logo').lean();
    if (!org) throw new NotFoundError('Organization');
    return { name: org.name, slug: org.slug, logo: org.logo || '' };
  }

  async bdaLogin(orgSlug: string, email: string, password: string) {
    const slug = normalizeOrgSlug(orgSlug);
    const organization = await Organization.findOne({ slug, isActive: true });
    if (!organization) throw new UnauthorizedError('Invalid email or password');

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      organizationId: organization._id,
      isActive: true,
    }).select('+password');
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const valid = await comparePassword(password, user.password);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    if (user.role === 'super_admin') {
      throw new ForbiddenError('Super admin must sign in at /platform-admin/login');
    }
    if (!(await isBdaOnlySalesUser(String(organization._id), String(user._id), user.role))) {
      throw new ForbiddenError('Use the company login at /login for this account');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), organization: this.sessionOrganization(organization), ...tokens };
  }

  async companyLogin(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true }).select('+password');
    if (!user) throw new UnauthorizedError('Invalid email or password');
    if (user.role === 'super_admin') {
      throw new ForbiddenError('Super admin must sign in at /admin/login');
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    const organization = await Organization.findById(user.organizationId);
    if (!organization) throw new UnauthorizedError('Organization not found');
    if (!organization.isActive) {
      throw new UnauthorizedError('Organization account is suspended');
    }

    if (await isBdaOnlySalesUser(String(organization._id), String(user._id), user.role)) {
      throw new ForbiddenError(`BDA accounts sign in at /${organization.slug}/bda`);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), organization: this.sessionOrganization(organization), ...tokens };
  }

  async adminLogin(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true }).select('+password');
    if (!user) throw new UnauthorizedError('Invalid email or password');
    if (user.role !== 'super_admin') {
      throw new ForbiddenError('Super admin access only. Company users should use the main login.');
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    const organization = await Organization.findById(user.organizationId);
    if (!organization) throw new UnauthorizedError('Organization not found');

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), organization: this.sessionOrganization(organization), ...tokens };
  }

  async login(email: string, password: string) {
    return this.companyLogin(email, password);
  }

  async refresh(refreshToken: string) {
    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await User.findById(stored.userId);
    if (!user || !user.isActive) throw new UnauthorizedError('User not found');

    await RefreshToken.deleteOne({ _id: stored._id });
    const tokens = await this.generateTokens(user);
    return tokens;
  }

  async logout(refreshToken: string) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }

  async getProfile(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');
    const organization = await Organization.findById(user.organizationId).select('name slug logo settings').lean();
    return { ...this.sanitizeUser(user), organization: this.sessionOrganization(organization) };
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string; avatar?: string }) {
    const user = await User.findByIdAndUpdate(userId, data, { new: true });
    if (!user) throw new NotFoundError('User');
    return this.sanitizeUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new NotFoundError('User');

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    user.password = await hashPassword(newPassword);
    await user.save();
    await RefreshToken.deleteMany({ userId: user._id });
  }

  private async generateTokens(user: InstanceType<typeof User>) {
    const payload = {
      id: user._id.toString(),
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      organizationId: user.organizationId.toString(),
      permissions: user.permissions ?? [],
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(user._id.toString());
    const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRY, 90 * 24 * 60 * 60 * 1000));

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  /** Only what the client needs to brand the app; profile and bank details stay behind `/settings`. */
  private sessionOrganization(org: { _id: unknown; name: string; slug: string; logo?: string; settings?: unknown } | null) {
    if (!org) return null;
    return { id: String(org._id), name: org.name, slug: org.slug, logo: org.logo || '', settings: org.settings };
  }

  private sanitizeUser(user: InstanceType<typeof User>) {
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar,
      phone: user.phone,
      role: user.role,
      department: user.department,
      organizationId: user.organizationId.toString(),
      permissions: permissionsForRole(user.role, user.permissions ?? []),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
