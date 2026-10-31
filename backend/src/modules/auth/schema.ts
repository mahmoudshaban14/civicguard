import { z } from 'zod';
import { toWesternDigits } from '../../utils/digits.js';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;


export const createUserSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
  // Citizens sign up themselves; this endpoint only creates staff accounts.
  role: z.enum(['admin', 'department_manager', 'employee']),
  department_id: z.string().guid('department_id must be a valid UUID').optional(),
  national_id: z.string()
    .trim()
    .transform(toWesternDigits)
    .refine((value) => /^\d{14}$/.test(value), {
      message: 'National ID must contain exactly 14 digits.',
    }),
}).superRefine((value, ctx) => {
  if (value.role === 'admin' && value.department_id) {
    ctx.addIssue({ code: 'custom', path: ['department_id'], message: 'Admin accounts cannot have a department.' });
  }
  if (value.role !== 'admin' && !value.department_id) {
    ctx.addIssue({ code: 'custom', path: ['department_id'], message: 'department_id is required for department managers and employees.' });
  }
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
