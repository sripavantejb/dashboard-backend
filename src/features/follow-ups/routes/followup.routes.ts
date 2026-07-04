import { Router } from 'express';
import { followUpController } from '../controllers/followup.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody, validateParams } from '../../../shared/middleware/validate.js';
import { z } from 'zod';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });

const createSchema = z.object({
  leadId: z.string(),
  type: z.enum(['phone', 'whatsapp', 'email', 'meeting', 'visit', 'demo', 'proposal', 'renewal', 'payment_reminder']),
  title: z.string().min(1),
  description: z.string().optional(),
  scheduledAt: z.string().datetime(),
  assignedTo: z.string().optional(),
  autoReminder: z.boolean().optional(),
});

router.use(authenticate);

router.get('/upcoming', authorize('leads:read', 'leads:*'), followUpController.getUpcoming.bind(followUpController));
router.get('/missed', authorize('leads:read', 'leads:*'), followUpController.getMissed.bind(followUpController));
router.get('/', authorize('leads:read', 'leads:*'), followUpController.findAll.bind(followUpController));
router.post('/', authorize('leads:*', 'leads:write'), validateBody(createSchema), followUpController.create.bind(followUpController));
router.patch('/:id/complete', authorize('leads:*', 'leads:write'), validateParams(idParam), followUpController.complete.bind(followUpController));
router.patch('/:id', authorize('leads:*', 'leads:write'), validateParams(idParam), followUpController.update.bind(followUpController));
router.delete('/:id', authorize('leads:*'), validateParams(idParam), followUpController.delete.bind(followUpController));

export default router;
