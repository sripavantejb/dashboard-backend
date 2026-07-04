import { Response, NextFunction } from 'express';
import { financeService } from '../services/finance.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class FinanceController {
  async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await financeService.getOverview(req.user!.organizationId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getProjectDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await financeService.getProjectDetail(
        req.user!.organizationId,
        req.params.projectId as string
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createBudgetPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payment = await financeService.createBudgetPayment(
        req.user!.organizationId,
        req.user!.id,
        req.body
      );
      res.status(201).json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  }

  async updateBudgetPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payment = await financeService.updateBudgetPayment(
        req.user!.organizationId,
        req.user!.id,
        req.params.id as string,
        req.body
      );
      res.json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  }

  async deleteBudgetPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await financeService.deleteBudgetPayment(
        req.user!.organizationId,
        req.user!.id,
        req.params.id as string
      );
      res.json({ success: true, message: 'Budget payment deleted' });
    } catch (error) {
      next(error);
    }
  }

  async createRevenueEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const entry = await financeService.createRevenueEntry(
        req.user!.organizationId,
        req.user!.id,
        req.body
      );
      res.status(201).json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  async deleteRevenueEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await financeService.deleteRevenueEntry(
        req.user!.organizationId,
        req.user!.id,
        req.params.id as string
      );
      res.json({ success: true, message: 'Revenue entry deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const financeController = new FinanceController();
