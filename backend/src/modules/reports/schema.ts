import { z } from 'zod';

export const listReportsQuerySchema = z.object({
  mine: z
    .enum(['1', '0', 'true', 'false'])
    .optional()
    .transform((val) => val === '1' || val === 'true'),
  status: z
    .enum([
      'submitted',
      'ai_analyzed',
      'assigned',
      'under_review',
      'in_progress',
      'resolved',
      'rejected',
      'duplicate',
      'invalid',
      'escalated',
      'manual_review_required',
    ])
    .optional(),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical', 'Requires Review']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
