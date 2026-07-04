import { z } from 'zod';

const leadStatusEnum = z.enum([
  'new', 'not_contacted', 'attempt_1', 'attempt_2', 'connected',
  'interested', 'meeting', 'demo', 'proposal', 'negotiation',
  'won', 'lost', 'future_follow_up', 'dormant',
]);

export const createLeadSchema = z.object({
  categoryId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  companyId: z.string().optional(),
  title: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  status: leadStatusEnum.optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assignedTo: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  estimatedValue: z.number().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
});

export const updateLeadSchema = createLeadSchema.partial().omit({ categoryId: true });

export const bulkUpdateLeadsSchema = z.object({
  leadIds: z.array(z.string()).min(1),
  updates: z.object({
    status: leadStatusEnum.optional(),
    assignedTo: z.string().optional(),
    tags: z.array(z.string()).optional(),
    inCallingQueue: z.boolean().optional(),
  }),
});

export const leadQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  categoryId: z.string().optional(),
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  inCallingQueue: z.enum(['true', 'false']).optional(),
  queueReady: z.enum(['true', 'false']).optional(),
  tags: z.string().optional(),
});

export const pipelineQuerySchema = z.object({
  categoryId: z.string().min(1),
});
