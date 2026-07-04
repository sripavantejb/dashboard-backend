import { Response, NextFunction } from 'express';
import { savedViewService } from '../services/savedview.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class SavedViewController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const view = await savedViewService.create(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: view });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const views = await savedViewService.findAll(req.user!.organizationId, req.user!.id);
      res.json({ success: true, data: views });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const view = await savedViewService.update(req.user!.organizationId, req.user!.id, req.params.id as string, req.body);
      res.json({ success: true, data: view });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await savedViewService.delete(req.user!.organizationId, req.user!.id, req.params.id as string);
      res.json({ success: true, message: 'View deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const savedViewController = new SavedViewController();
