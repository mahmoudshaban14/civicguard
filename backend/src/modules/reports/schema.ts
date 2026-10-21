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

export const createReportSchema = z.object({
  category_id: z.string().min(1, 'category_id is required'),
  description: z.string().max(2000, 'Description must not exceed 2000 characters').optional(),
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  area_name: z.string().max(255).optional(),
  image_path: z.string().optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const getReportParamsSchema = z.object({
  id: z.string().uuid('Report id must be a valid UUID'),
});

export type GetReportParams = z.infer<typeof getReportParamsSchema>;

export const nearbyReportsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  radius: z.coerce.number().min(100).max(50000).default(5000), // meters (default 5km, max 50km)
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type NearbyReportsQuery = z.infer<typeof nearbyReportsQuerySchema>;
