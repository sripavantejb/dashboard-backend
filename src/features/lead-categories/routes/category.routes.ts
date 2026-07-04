import { Router } from 'express';
import { leadCategoryController } from '../controllers/category.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../../shared/middleware/validate.js';
import { createCategorySchema, updateCategorySchema, categoryQuerySchema } from '../validators/category.validator.js';
import { z } from 'zod';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });

router.use(authenticate);

router.get('/', authorize('categories:read', 'categories:*', 'leads:read', 'leads:*'), validateQuery(categoryQuerySchema), leadCategoryController.findAll.bind(leadCategoryController));
router.post('/', authorize('categories:*'), validateBody(createCategorySchema), leadCategoryController.create.bind(leadCategoryController));
router.get('/:id', authorize('categories:read', 'categories:*', 'leads:read', 'leads:*'), validateParams(idParam), leadCategoryController.findById.bind(leadCategoryController));
router.patch('/:id', authorize('categories:*'), validateParams(idParam), validateBody(updateCategorySchema), leadCategoryController.update.bind(leadCategoryController));
router.delete('/:id', authorize('categories:*'), validateParams(idParam), leadCategoryController.delete.bind(leadCategoryController));

export default router;
