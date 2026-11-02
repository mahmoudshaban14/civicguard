import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const workOrderIdParamsSchema = z.object({
  id: uuidSchema,
});

export const listWorkOrdersQuerySchema = z.object({
  status: z.enum([
    'pending',
    'assigned',
    'in_progress',
    'pending_verification',
    'completed',
    'cancelled',
  ]).optional(),
  mine: z.enum(['0', '1']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createWorkOrderSchema = z.object({
  reportId: uuidSchema,
  departmentId: uuidSchema,
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  targetAt: z.string().datetime().optional(),
  assignedTo: uuidSchema.optional(),
});

export const assignWorkOrderSchema = z.object({
  assignedTo: uuidSchema,
  note: z.string().trim().max(1000).optional(),
});

export const submitCompletionSchema = z.object({
  afterPaths: z.array(z.string().min(1)).min(1).max(5),
  notes: z.string().trim().max(2000).optional(),
});

export const reviewWorkOrderSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(2000).optional(),
});

export const cancelWorkOrderSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export type ListWorkOrdersQuery = z.infer<typeof listWorkOrdersQuerySchema>;
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type AssignWorkOrderInput = z.infer<typeof assignWorkOrderSchema>;
export type SubmitCompletionInput = z.infer<typeof submitCompletionSchema>;
export type ReviewWorkOrderInput = z.infer<typeof reviewWorkOrderSchema>;
export type CancelWorkOrderInput = z.infer<typeof cancelWorkOrderSchema>;