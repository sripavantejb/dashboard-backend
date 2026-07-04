import { Router } from 'express';
import { proposalController } from '../controllers/proposal.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody, validateParams } from '../../../shared/middleware/validate.js';
import { z } from 'zod';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });

const createSchema = z.object({
  leadId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().min(1),
    rate: z.number().min(0),
  })).optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().optional(),
});

router.use(authenticate);

router.get('/', authorize('leads:read', 'leads:*'), proposalController.findAll.bind(proposalController));
router.post('/', authorize('leads:*', 'leads:write'), validateBody(createSchema), proposalController.create.bind(proposalController));
router.get('/:id', authorize('leads:read', 'leads:*'), validateParams(idParam), proposalController.findById.bind(proposalController));
router.patch('/:id', authorize('leads:*', 'leads:write'), validateParams(idParam), proposalController.update.bind(proposalController));
router.post('/:id/send', authorize('leads:*', 'leads:write'), validateParams(idParam), proposalController.send.bind(proposalController));
router.delete('/:id', authorize('leads:*'), validateParams(idParam), proposalController.delete.bind(proposalController));

export default router;
