import { Response, NextFunction } from 'express';
import { expenseService } from '../services/expense.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class ExpenseController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.create(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await expenseService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.findById(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.update(req.user!.organizationId, req.user!.id, req.params.id as string, req.body);
      res.json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await expenseService.delete(req.user!.organizationId, req.user!.id, req.params.id as string);
      res.json({ success: true, message: 'Expense deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const expenseController = new ExpenseController();
