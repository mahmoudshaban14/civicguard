import { z } from 'zod';

export const workOrderIdParamSchema = z.object({
  id: z.string().guid('Invalid work order ID'),
});

export const listWorkOrdersQuerySchema = z.object({
  status: z
    .enum([
      'pending',
      'assigned',
      'in_progress',
      'pending_verification',
      'completed',
      'cancelled',
    ])
    .optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  department_id: z.string().guid('Invalid department ID').optional(),
  assigned_to: z.string().guid('Invalid assignee ID').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListWorkOrdersQuery = z.infer<typeof listWorkOrdersQuerySchema>;

export const createWorkOrderSchema = z.object({
  report_id: z.string().guid('Invalid report ID'),
  department_id: z.string().guid('Invalid department ID'),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  target_completion_at: z.string().datetime().optional(),
  assigned_to: z.string().guid('Invalid assignee ID').optional(),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

export const assignWorkOrderSchema = z.object({
  assigned_to: z.string().guid('Invalid assignee ID'),
  note: z.string().trim().max(500).optional(),
});

export type AssignWorkOrderInput = z.infer<typeof assignWorkOrderSchema>;

export const submitWorkOrderCompletionSchema = z.object({
  after_paths: z
    .array(z.string().trim().min(1))
    .min(1, 'At least 1 after photo is required')
    .max(5, 'A maximum of 5 after photos is allowed'),
  notes: z.string().trim().max(1000).optional(),
});

export type SubmitWorkOrderCompletionInput = z.infer<
  typeof submitWorkOrderCompletionSchema
>;

export const signEvidenceUploadSchema = z.object({
  file_name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/\.(jpe?g|png|webp)$/i, 'Allowed formats: jpg, jpeg, png, webp'),
});

export type SignEvidenceUploadInput = z.infer<typeof signEvidenceUploadSchema>;

export const addEvidenceSchema = z.object({
  storage_path: z.string().trim().min(1),
  kind: z.enum(['after', 'additional']).default('additional'),
  notes: z.string().trim().max(500).optional(),
});

export type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;

export const reviewWorkOrderSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.decision === 'rejected' && (!val.note || val.note.trim() === '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'A review note is required when rejecting a work order',
      });
    }
  });

export type ReviewWorkOrderInput = z.infer<typeof reviewWorkOrderSchema>;

export const cancelWorkOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Cancellation reason must be at least 3 characters')
    .max(500),
});

export type CancelWorkOrderInput = z.infer<typeof cancelWorkOrderSchema>;

