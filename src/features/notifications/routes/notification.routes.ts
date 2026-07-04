import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../../../shared/middleware/auth.js';
import { z } from 'zod';
import { validateParams } from '../../../shared/middleware/validate.js';

const router = Router();
const idParam = z.object({ id: z.string().min(1) });

router.use(authenticate);

router.get('/', notificationController.findAll.bind(notificationController));
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));
router.patch('/read-all', notificationController.markAllAsRead.bind(notificationController));
router.patch('/:id/read', validateParams(idParam), notificationController.markAsRead.bind(notificationController));

export default router;
