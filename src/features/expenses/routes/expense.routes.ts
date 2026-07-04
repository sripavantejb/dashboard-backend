import { Router } from 'express';
import { z } from 'zod';
import { expenseController } from '../controllers/expense.controller.js';
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
  status: z.enum(['paid', 'pending']).optional(),
  category: z.string().optional(),
  projectId: z.string().optional(),
});

const createSchema = z.object({
  title: z.string().min(1),
  amount: z.number().min(0),
  category: z.enum(['marketing', 'salaries', 'software', 'office', 'travel', 'utilities', 'other']).optional(),
  vendor: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.enum(['paid', 'pending']).optional(),
  spentAt: z.string().optional(),
  notes: z.string().optional(),
  projectId: z.string().optional(),
});

const updateSchema = createSchema.partial();

router.use(authenticate);

router.get('/', authorize('finance:read', 'finance:*'), validateQuery(querySchema), expenseController.findAll.bind(expenseController));
router.post('/', authorize('finance:*', 'finance:write'), validateBody(createSchema), expenseController.create.bind(expenseController));
router.get('/:id', authorize('finance:read', 'finance:*'), validateParams(idParam), expenseController.findById.bind(expenseController));
router.patch('/:id', authorize('finance:*', 'finance:write'), validateParams(idParam), validateBody(updateSchema), expenseController.update.bind(expenseController));
router.delete('/:id', authorize('finance:*'), validateParams(idParam), expenseController.delete.bind(expenseController));

export default router;
