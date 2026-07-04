import { Request, Response, NextFunction } from 'express';
import { accessRequestService } from '../services/access-request.service.js';

export class AccessRequestController {
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await accessRequestService.submit(req.body);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Request submitted successfully. Our team will contact you shortly.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const accessRequestController = new AccessRequestController();
