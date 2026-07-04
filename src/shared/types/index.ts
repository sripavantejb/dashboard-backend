import { Request } from 'express';

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'sales'
  | 'marketing'
  | 'hr'
  | 'finance'
  | 'operations'
  | 'developer'
  | 'client';

export const ALL_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'manager',
  'sales',
  'marketing',
  'hr',
  'finance',
  'operations',
  'developer',
  'client',
];

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ['*'],
  admin: [
    'users:*', 'leads:*', 'tasks:*', 'projects:*', 'finance:*',
    'reports:*', 'settings:*', 'categories:*', 'pipeline:*',
    'notifications:*', 'dashboard:*', 'employees:*',
  ],
  manager: [
    'leads:*', 'tasks:*', 'projects:read', 'projects:write',
    'reports:read', 'dashboard:*', 'pipeline:*', 'employees:read',
    'notifications:*', 'categories:read',
  ],
  sales: [
    'leads:*', 'tasks:read', 'tasks:write', 'pipeline:*',
    'dashboard:read', 'notifications:read', 'categories:read',
    'contacts:*', 'companies:*',
  ],
  marketing: [
    'leads:read', 'dashboard:read', 'reports:read',
    'campaigns:*', 'notifications:read',
  ],
  hr: [
    'employees:*', 'attendance:*', 'leaves:*',
    'dashboard:read', 'notifications:read',
  ],
  finance: [
    'finance:*', 'invoices:*', 'payments:*',
    'dashboard:read', 'reports:read', 'notifications:read',
  ],
  operations: [
    'projects:*', 'tasks:*', 'dashboard:read',
    'notifications:read', 'leads:read',
  ],
  developer: [
    'integrations:*', 'settings:read', 'dashboard:read',
    'notifications:read',
  ],
  client: [
    'portal:*', 'projects:read', 'invoices:read',
    'documents:read', 'notifications:read',
  ],
};

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  if (user.permissions.includes('*')) return true;
  const [resource, action] = permission.split(':');
  return user.permissions.some((p) => {
    if (p === permission) return true;
    if (p === `${resource}:*`) return true;
    return false;
  });
}
