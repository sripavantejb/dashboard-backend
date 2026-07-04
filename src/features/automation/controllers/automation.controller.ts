import { Response, NextFunction } from 'express';
import { automationService } from '../services/automation.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class AutomationController {
  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rules = await automationService.findAll(req.user!.organizationId);
      res.json({ success: true, data: rules });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rule = await automationService.create(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: rule });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rule = await automationService.update(req.user!.organizationId, req.params.id as string, req.body);
      res.json({ success: true, data: rule });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await automationService.delete(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const automationController = new AutomationController();
