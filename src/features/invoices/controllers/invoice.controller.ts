import { Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class InvoiceController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.create(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await invoiceService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.findById(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.update(req.user!.organizationId, req.params.id as string, req.body);
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await invoiceService.delete(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, message: 'Invoice deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const invoiceController = new InvoiceController();
