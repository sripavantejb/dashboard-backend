import { Router } from 'express';
import { callLogController } from '../controllers/call.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { validateBody } from '../../../shared/middleware/validate.js';
import { z } from 'zod';

const router = Router();

const logCallSchema = z.object({
  leadId: z.string(),
  outcome: z.enum(['connected', 'busy', 'no_answer', 'switched_off', 'call_back', 'interested', 'meeting', 'proposal', 'won', 'lost']),
  duration: z.number().optional(),
  notes: z.string().optional(),
  scriptUsed: z.string().optional(),
  recordingUrl: z.string().optional(),
  scheduledCallback: z.string().datetime().optional(),
}).refine(
  (data) => data.outcome !== 'call_back' || !!data.scheduledCallback,
  { message: 'scheduledCallback is required when outcome is call_back', path: ['scheduledCallback'] }
);

router.use(authenticate);

router.get('/daily', authorize('leads:read', 'leads:*'), callLogController.getDailyStats.bind(callLogController));
router.get('/analytics', authorize('leads:read', 'leads:*'), callLogController.getAnalytics.bind(callLogController));
router.get('/', authorize('leads:read', 'leads:*'), callLogController.findAll.bind(callLogController));
router.post('/', authorize('leads:*', 'leads:write'), validateBody(logCallSchema), callLogController.logCall.bind(callLogController));

export default router;
