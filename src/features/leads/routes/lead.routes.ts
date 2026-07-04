import { Router } from 'express';
import { leadController } from '../controllers/lead.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../../shared/middleware/validate.js';
import { createLeadSchema, updateLeadSchema, bulkUpdateLeadsSchema, leadQuerySchema, pipelineQuerySchema } from '../validators/lead.validator.js';
import { z } from 'zod';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });
const activitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'whatsapp', 'note', 'status_change', 'assignment', 'document', 'proposal', 'invoice']),
  title: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.use(authenticate);

router.get('/', authorize('leads:read', 'leads:*'), validateQuery(leadQuerySchema), leadController.findAll.bind(leadController));
router.post('/', authorize('leads:*', 'leads:write'), validateBody(createLeadSchema), leadController.create.bind(leadController));
router.get('/pipeline', authorize('pipeline:*', 'leads:read', 'leads:*'), validateQuery(pipelineQuerySchema), leadController.getPipeline.bind(leadController));
router.patch('/bulk', authorize('leads:*', 'leads:write'), validateBody(bulkUpdateLeadsSchema), leadController.bulkUpdate.bind(leadController));
router.get('/:id', authorize('leads:read', 'leads:*'), validateParams(idParam), leadController.findById.bind(leadController));
router.patch('/:id', authorize('leads:*', 'leads:write'), validateParams(idParam), validateBody(updateLeadSchema), leadController.update.bind(leadController));
router.delete('/:id', authorize('leads:*'), validateParams(idParam), leadController.delete.bind(leadController));
router.get('/:id/activities', authorize('leads:read', 'leads:*'), validateParams(idParam), leadController.getActivities.bind(leadController));
router.post('/:id/activities', authorize('leads:*', 'leads:write'), validateParams(idParam), validateBody(activitySchema), leadController.addActivity.bind(leadController));

export default router;
