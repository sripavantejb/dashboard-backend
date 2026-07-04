import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { accessRequestController } from '../controllers/access-request.controller.js';
import { validateBody } from '../../../shared/middleware/validate.js';

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests. Please try again later.' } },
});

const submitSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  companyName: z.string().min(2).max(200),
  phone: z.string().max(30).optional(),
  teamSize: z.string().max(50).optional(),
  message: z.string().max(2000).optional(),
});

router.post(
  '/',
  submitLimiter,
  validateBody(submitSchema),
  accessRequestController.submit.bind(accessRequestController)
);

export default router;
