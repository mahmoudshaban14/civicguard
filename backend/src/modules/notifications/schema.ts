import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
