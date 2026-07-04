import { Router } from 'express';
import { z } from 'zod';
import { financeController } from '../controllers/finance.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody, validateParams } from '../../../shared/middleware/validate.js';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });
const projectIdParam = z.object({ projectId: z.string().min(1) });

const budgetPaymentSchema = z.object({
  projectId: z.string().min(1),
  label: z.string().min(1),
  amount: z.number().min(0),
  status: z.enum(['received', 'pending']).optional(),
  receivedAt: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

const budgetPaymentUpdateSchema = budgetPaymentSchema.omit({ projectId: true }).partial();

const revenueEntrySchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(['credit', 'debit']),
  amount: z.number().min(0),
  description: z.string().min(1),
  recordedAt: z.string().optional(),
});

router.use(authenticate);

router.get('/overview', authorize('finance:read', 'finance:*'), financeController.getOverview.bind(financeController));
router.get(
  '/projects/:projectId',
  authorize('finance:read', 'finance:*'),
  validateParams(projectIdParam),
  financeController.getProjectDetail.bind(financeController)
);

router.post(
  '/budget-payments',
  authorize('finance:*', 'finance:write'),
  validateBody(budgetPaymentSchema),
  financeController.createBudgetPayment.bind(financeController)
);
router.patch(
  '/budget-payments/:id',
  authorize('finance:*', 'finance:write'),
  validateParams(idParam),
  validateBody(budgetPaymentUpdateSchema),
  financeController.updateBudgetPayment.bind(financeController)
);
router.delete(
  '/budget-payments/:id',
  authorize('finance:*'),
  validateParams(idParam),
  financeController.deleteBudgetPayment.bind(financeController)
);

router.post(
  '/revenue-entries',
  authorize('finance:*', 'finance:write'),
  validateBody(revenueEntrySchema),
  financeController.createRevenueEntry.bind(financeController)
);
router.delete(
  '/revenue-entries/:id',
  authorize('finance:*'),
  validateParams(idParam),
  financeController.deleteRevenueEntry.bind(financeController)
);

export default router;
