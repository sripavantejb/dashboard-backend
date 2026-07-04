import { Response, NextFunction } from 'express';
import { projectService } from '../services/project.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class ProjectController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.create(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await projectService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.findById(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.update(req.user!.organizationId, req.params.id as string, req.body);
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await projectService.delete(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, message: 'Project deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const projectController = new ProjectController();
