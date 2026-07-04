import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  customFields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'email', 'phone', 'date', 'select', 'boolean', 'url']),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
  })).optional(),
  pipelineStages: z.array(z.string()).optional(),
  assignedTeam: z.array(z.string()).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});
