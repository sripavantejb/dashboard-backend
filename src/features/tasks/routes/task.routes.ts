import { Router } from 'express';
import { taskController } from '../controllers/task.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../../shared/middleware/validate.js';
import { createTaskSchema, updateTaskSchema, taskQuerySchema } from '../validators/task.validator.js';
import { z } from 'zod';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });

router.use(authenticate);

router.get('/', authorize('tasks:read', 'tasks:*'), validateQuery(taskQuerySchema), taskController.findAll.bind(taskController));
router.post('/', authorize('tasks:*', 'tasks:write'), validateBody(createTaskSchema), taskController.create.bind(taskController));
router.get('/:id', authorize('tasks:read', 'tasks:*'), validateParams(idParam), taskController.findById.bind(taskController));
router.patch('/:id', authorize('tasks:*', 'tasks:write'), validateParams(idParam), validateBody(updateTaskSchema), taskController.update.bind(taskController));
router.delete('/:id', authorize('tasks:*'), validateParams(idParam), taskController.delete.bind(taskController));

export default router;
