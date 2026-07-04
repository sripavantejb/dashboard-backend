import { Response, NextFunction } from 'express';
import { callLogService } from '../services/call.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class CallLogController {
  async logCall(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const call = await callLogService.logCall(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: call });
    } catch (error) {
      next(error);
    }
  }

  async getDailyStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const stats = await callLogService.getDailyStats(
        req.user!.organizationId,
        req.user!.id,
        req.query.date as string | undefined
      );
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await callLogService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const days = Number(req.query.days) || 7;
      const analytics = await callLogService.getAnalytics(req.user!.organizationId, days);
      res.json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  }
}

export const callLogController = new CallLogController();
