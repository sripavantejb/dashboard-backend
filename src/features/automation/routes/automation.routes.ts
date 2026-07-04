import { Router } from 'express';
import { z } from 'zod';
import { automationController } from '../controllers/automation.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody, validateParams } from '../../../shared/middleware/validate.js';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });
const createSchema = z.object({
  name: z.string().min(2).max(200),
  trigger: z.string().min(2),
  action: z.string().min(2),
  status: z.enum(['active', 'draft']).optional(),
});
const updateSchema = createSchema.partial();

router.use(authenticate);

router.get('/', authorize('settings:*', 'settings:read'), automationController.findAll.bind(automationController));
router.post('/', authorize('settings:*', 'settings:write'), validateBody(createSchema), automationController.create.bind(automationController));
router.patch('/:id', authorize('settings:*', 'settings:write'), validateParams(idParam), validateBody(updateSchema), automationController.update.bind(automationController));
router.delete('/:id', authorize('settings:*'), validateParams(idParam), automationController.delete.bind(automationController));

export default router;
