import { Router } from 'express';
import { z } from 'zod';
import { projectController } from '../controllers/project.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../../shared/middleware/validate.js';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });
const querySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  status: z.string().optional(),
});
const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  budget: z.number().optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
const updateSchema = createSchema.partial();

router.use(authenticate);

router.get('/', authorize('projects:read', 'projects:*'), validateQuery(querySchema), projectController.findAll.bind(projectController));
router.post('/', authorize('projects:*', 'projects:write'), validateBody(createSchema), projectController.create.bind(projectController));
router.get('/:id', authorize('projects:read', 'projects:*'), validateParams(idParam), projectController.findById.bind(projectController));
router.patch('/:id', authorize('projects:*', 'projects:write'), validateParams(idParam), validateBody(updateSchema), projectController.update.bind(projectController));
router.delete('/:id', authorize('projects:*'), validateParams(idParam), projectController.delete.bind(projectController));

export default router;
