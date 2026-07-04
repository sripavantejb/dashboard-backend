import { Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors/index.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { AuthenticatedRequest, hasPermission } from '../types/index.js';

export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Access token required'));
  }

  try {
    const token = header.slice(7);
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}

export function authorize(...permissions: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());

    const allowed = permissions.some((p) => hasPermission(req.user!, p));
    if (!allowed) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}

export function authorizeRoles(...roles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Role not authorized'));
    }
    next();
  };
}
