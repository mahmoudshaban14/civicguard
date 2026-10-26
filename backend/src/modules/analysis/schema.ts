import { z } from 'zod';

export const analyzeReportSchema = z.object({
  image_path: z.string().min(1, 'image_path is required'),
  description: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  area_name: z.string().max(255).optional(),
});

export type AnalyzeReportInput = z.infer<typeof analyzeReportSchema>;
