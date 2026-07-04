import { Response, NextFunction } from 'express';
import { leadService } from '../services/lead.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class LeadController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.create(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: lead });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await leadService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.findById(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: lead });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.update(req.user!.organizationId, req.user!.id, req.params.id as string, req.body);
      res.json({ success: true, data: lead });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { leadIds, updates } = req.body;
      const result = await leadService.bulkUpdate(req.user!.organizationId, req.user!.id, leadIds, updates);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await leadService.delete(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, message: 'Lead archived' });
    } catch (error) {
      next(error);
    }
  }

  async getPipeline(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await leadService.getPipeline(req.user!.organizationId, req.query.categoryId as string);
      res.json({ success: true, data: pipeline });
    } catch (error) {
      next(error);
    }
  }

  async getActivities(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const activities = await leadService.getActivities(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: activities });
    } catch (error) {
      next(error);
    }
  }

  async addActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const activity = await leadService.addActivity(req.user!.organizationId, req.user!.id, req.params.id as string, req.body);
      res.status(201).json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }
}

export const leadController = new LeadController();
