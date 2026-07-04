import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['pending', 'assigned', 'in_progress', 'review', 'completed', 'cancelled', 'overdue']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.string().optional(),
  projectId: z.string().optional(),
  leadId: z.string().optional(),
  parentTaskId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  checklist: z.array(z.object({ text: z.string(), completed: z.boolean().default(false) })).optional(),
  tags: z.array(z.string()).optional(),
  estimatedHours: z.number().optional(),
  isRecurring: z.boolean().optional(),
  recurringPattern: z.string().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const taskQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional(),
  projectId: z.string().optional(),
});
