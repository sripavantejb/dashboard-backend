import { Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class DashboardController {
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const stats = await dashboardService.getStats(req.user!.organizationId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
