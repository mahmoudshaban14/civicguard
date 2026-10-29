import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;


const normalizeNationalIdDigits = (value: string) =>
  value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
  });

export const createUserSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
  role: z.enum(['admin', 'authority']),
  national_id: z.string()
    .trim()
    .transform(normalizeNationalIdDigits)
    .refine((value) => /^\d{14}$/.test(value), {
      message: 'National ID must contain exactly 14 digits.',
    }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
