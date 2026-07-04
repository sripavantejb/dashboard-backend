import { Router } from 'express';
import { z } from 'zod';
import { invoiceController } from '../controllers/invoice.controller.js';
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
const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0),
  rate: z.number().min(0),
  taxRate: z.number().optional(),
});
const createSchema = z.object({
  invoiceNumber: z.string().optional(),
  items: z.array(itemSchema).min(1),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});
const updateSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

router.use(authenticate);

router.get('/', authorize('finance:read', 'finance:*'), validateQuery(querySchema), invoiceController.findAll.bind(invoiceController));
router.post('/', authorize('finance:*', 'finance:write'), validateBody(createSchema), invoiceController.create.bind(invoiceController));
router.get('/:id', authorize('finance:read', 'finance:*'), validateParams(idParam), invoiceController.findById.bind(invoiceController));
router.patch('/:id', authorize('finance:*', 'finance:write'), validateParams(idParam), validateBody(updateSchema), invoiceController.update.bind(invoiceController));
router.delete('/:id', authorize('finance:*'), validateParams(idParam), invoiceController.delete.bind(invoiceController));

export default router;
