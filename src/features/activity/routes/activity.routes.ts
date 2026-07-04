import { Router } from 'express';
import { z } from 'zod';
import { activityController } from '../controllers/activity.controller.js';
import { authenticate } from '../../../shared/middleware/auth.js';
import { validateBody } from '../../../shared/middleware/validate.js';

const router = Router();

const heartbeatSchema = z.object({
  page: z.string().optional(),
  module: z.string().optional(),
  sessionId: z.string().optional(),
});

router.use(authenticate);
router.post('/heartbeat', validateBody(heartbeatSchema), activityController.heartbeat.bind(activityController));

export default router;
