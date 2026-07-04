import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditLog } from '../../models/AuditLog.js';

export function auditLog(action: string, entityType: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body: Record<string, unknown>) {
      if (req.user && res.statusCode < 400) {
        const data = body?.data as Record<string, unknown> | undefined;
        AuditLog.create({
          organizationId: req.user.organizationId,
          userId: req.user.id,
          action,
          entityType,
          entityId: (req.params.id as string) || (data?._id as string) || (data?.id as string),
          metadata: {
            method: req.method,
            path: req.originalUrl,
            body: sanitizeBody(req.body),
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  if (!body) return {};
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.currentPassword;
  delete sanitized.newPassword;
  return sanitized;
}
