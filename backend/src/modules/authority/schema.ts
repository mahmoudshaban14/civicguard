import { z } from 'zod';

export const authorityReportsQuerySchema = z.object({
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
  department_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(1000).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type AuthorityReportsQuery = z.infer<typeof authorityReportsQuerySchema>;

export const reportIdParamsSchema = z.object({
  id: z.string().uuid('Report id must be a valid UUID'),
});

export type ReportIdParams = z.infer<typeof reportIdParamsSchema>;

export const updateReportStatusSchema = z.object({
  status: z.enum([
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
  ]),
  note: z.string().max(1000).optional(),
  // Only meaningful when status = 'duplicate': the report this one duplicates.
  duplicate_of: z.string().uuid().optional(),
  department: z.string().nullable().optional(),
});

export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>;

export const assignReportDepartmentSchema = z.object({
  department_id: z.string().uuid('department_id must be a valid UUID'),
  note: z.string().max(1000).optional(),
});

export type AssignReportDepartmentInput = z.infer<typeof assignReportDepartmentSchema>;

export const updateReportActionStatusSchema = z.object({
  action_status: z.enum(['pending_action', 'action_in_progress', 'action_completed']),
});

export type UpdateReportActionStatusInput = z.infer<typeof updateReportActionStatusSchema>;


