import { z } from 'zod';

export const signUploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'contentType must be one of: image/jpeg, image/png, image/webp' }),
  }),
  sizeBytes: z
    .number()
    .positive('sizeBytes must be positive')
    .max(5 * 1024 * 1024, 'Image size exceeds maximum 5MB limit')
    .optional(),
  fileName: z.string().optional(),
});

export type SignUploadInput = z.infer<typeof signUploadSchema>;
