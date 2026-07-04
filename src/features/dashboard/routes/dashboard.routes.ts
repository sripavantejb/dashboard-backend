import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';

const router = Router();

router.get('/stats', authenticate, authorize('dashboard:read', 'dashboard:*'), dashboardController.getStats.bind(dashboardController));

export default router;
