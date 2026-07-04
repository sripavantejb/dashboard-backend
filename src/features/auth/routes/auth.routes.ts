import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validateBody } from '../../../shared/middleware/validate.js';
import { authenticate } from '../../../shared/middleware/auth.js';
import { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from '../validators/auth.validator.js';

const router = Router();

router.post('/register', validateBody(registerSchema), authController.register.bind(authController));
router.get('/settings/public', authController.getPublicSettings.bind(authController));
router.get('/invite/:token', authController.validateInvite.bind(authController));
router.post('/login', validateBody(loginSchema), authController.login.bind(authController));
router.post('/admin/login', validateBody(loginSchema), authController.adminLogin.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.get('/me', authenticate, authController.getProfile.bind(authController));
router.patch('/me', authenticate, validateBody(updateProfileSchema), authController.updateProfile.bind(authController));
router.post('/change-password', authenticate, validateBody(changePasswordSchema), authController.changePassword.bind(authController));

export default router;
