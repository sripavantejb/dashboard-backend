import { Response, NextFunction } from 'express';
import { proposalService } from '../services/proposal.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

export class ProposalController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const proposal = await proposalService.create(req.user!.organizationId, req.user!.id, req.body);
      res.status(201).json({ success: true, data: proposal });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await proposalService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const proposal = await proposalService.findById(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: proposal });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const proposal = await proposalService.update(req.user!.organizationId, req.params.id as string, req.body);
      res.json({ success: true, data: proposal });
    } catch (error) {
      next(error);
    }
  }

  async send(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const proposal = await proposalService.send(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: proposal });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await proposalService.delete(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, message: 'Proposal deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const proposalController = new ProposalController();
