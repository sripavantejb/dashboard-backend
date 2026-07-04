import { Response, NextFunction } from 'express';
import { userService } from '../services/user.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class UserController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.create(req.user!.organizationId, req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await userService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.update(req.user!.organizationId, req.params.id as string, req.body);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await userService.deactivate(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, message: 'User deactivated' });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
