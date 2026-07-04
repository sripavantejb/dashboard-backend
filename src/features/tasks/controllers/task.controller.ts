import { Response, NextFunction } from 'express';
import { taskService } from '../services/task.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class TaskController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const task = await taskService.create(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await taskService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const task = await taskService.findById(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const task = await taskService.update(req.user!.organizationId, req.user!.id, req.params.id as string, req.body);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await taskService.delete(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, message: 'Task deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
