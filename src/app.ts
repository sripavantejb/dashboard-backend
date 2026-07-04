import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';

import authRoutes from './features/auth/routes/auth.routes.js';
import dashboardRoutes from './features/dashboard/routes/dashboard.routes.js';
import leadCategoryRoutes from './features/lead-categories/routes/category.routes.js';
import leadRoutes from './features/leads/routes/lead.routes.js';
import taskRoutes from './features/tasks/routes/task.routes.js';
import notificationRoutes from './features/notifications/routes/notification.routes.js';
import importRoutes from './features/import/routes/import.routes.js';
import callRoutes from './features/calling/routes/call.routes.js';
import followUpRoutes from './features/follow-ups/routes/followup.routes.js';
import proposalRoutes from './features/proposals/routes/proposal.routes.js';
import savedViewRoutes from './features/saved-views/routes/savedview.routes.js';
import projectRoutes from './features/projects/routes/project.routes.js';
import invoiceRoutes from './features/invoices/routes/invoice.routes.js';
import expenseRoutes from './features/expenses/routes/expense.routes.js';
import userRoutes from './features/users/routes/user.routes.js';
import automationRoutes from './features/automation/routes/automation.routes.js';
import adminRoutes from './features/admin/routes/admin.routes.js';
import activityRoutes from './features/activity/routes/activity.routes.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Agency ERP API is running', version: '1.0.0' });
});

const v1 = express.Router();
v1.use('/auth', authRoutes);
v1.use('/dashboard', dashboardRoutes);
v1.use('/lead-categories', leadCategoryRoutes);
v1.use('/leads', leadRoutes);
v1.use('/tasks', taskRoutes);
v1.use('/notifications', notificationRoutes);
v1.use('/imports', importRoutes);
v1.use('/calls', callRoutes);
v1.use('/follow-ups', followUpRoutes);
v1.use('/proposals', proposalRoutes);
v1.use('/saved-views', savedViewRoutes);
v1.use('/projects', projectRoutes);
v1.use('/invoices', invoiceRoutes);
v1.use('/expenses', expenseRoutes);
v1.use('/users', userRoutes);
v1.use('/automation', automationRoutes);
v1.use('/admin', adminRoutes);
v1.use('/activity', activityRoutes);

app.use('/api/v1', v1);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
