import { Response, NextFunction } from 'express';
import { activityService } from '../services/activity.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class ActivityController {
  async heartbeat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await activityService.heartbeat(
        req.user!.organizationId,
        req.user!.id,
        req.body,
        { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const activityController = new ActivityController();
