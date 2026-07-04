import { Router } from 'express';
import { savedViewController } from '../controllers/savedview.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody, validateParams } from '../../../shared/middleware/validate.js';
import { z } from 'zod';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });

const createSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  sort: z.object({ field: z.string(), order: z.enum(['asc', 'desc']) }).optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
});

router.use(authenticate);

router.get('/', authorize('leads:read', 'leads:*'), savedViewController.findAll.bind(savedViewController));
router.post('/', authorize('leads:*', 'leads:write'), validateBody(createSchema), savedViewController.create.bind(savedViewController));
router.patch('/:id', authorize('leads:*', 'leads:write'), validateParams(idParam), savedViewController.update.bind(savedViewController));
router.delete('/:id', authorize('leads:*'), validateParams(idParam), savedViewController.delete.bind(savedViewController));

export default router;
