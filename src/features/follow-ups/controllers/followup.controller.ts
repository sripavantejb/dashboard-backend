import { Response, NextFunction } from 'express';
import { followUpService } from '../services/followup.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class FollowUpController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const followUp = await followUpService.create(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: followUp });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await followUpService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getUpcoming(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const days = Number(req.query.days) || 7;
      const upcoming = await followUpService.getUpcoming(req.user!.organizationId, req.user!.id, days);
      res.json({ success: true, data: upcoming });
    } catch (error) {
      next(error);
    }
  }

  async getMissed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const missed = await followUpService.getMissed(req.user!.organizationId);
      res.json({ success: true, data: missed });
    } catch (error) {
      next(error);
    }
  }

  async complete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const followUp = await followUpService.complete(req.user!.organizationId, req.params.id as string, req.body.notes);
      res.json({ success: true, data: followUp });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const followUp = await followUpService.update(req.user!.organizationId, req.params.id as string, req.body);
      res.json({ success: true, data: followUp });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await followUpService.delete(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, message: 'Follow-up deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const followUpController = new FollowUpController();
