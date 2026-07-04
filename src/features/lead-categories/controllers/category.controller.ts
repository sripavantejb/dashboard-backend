import { Response, NextFunction } from 'express';
import { leadCategoryService } from '../services/category.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class LeadCategoryController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const category = await leadCategoryService.create(req.user!.organizationId, req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await leadCategoryService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const category = await leadCategoryService.findById(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const category = await leadCategoryService.update(req.user!.organizationId, req.params.id as string, req.body);
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await leadCategoryService.delete(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const leadCategoryController = new LeadCategoryController();
