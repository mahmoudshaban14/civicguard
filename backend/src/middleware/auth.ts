
import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../db/client.js';
import { AppError } from './error-handler.js';

export type UserRole =
  | 'citizen'
  | 'employee'
  | 'department_manager'
  | 'admin';

export interface AuthUser {
  id: string;
  email?: string;
  role: UserRole;
  department_id: string | null;
  full_name: string | null;
  is_active: boolean;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: AuthUser;
      token?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication token required');
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication token required');
  }

  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired authentication token');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, department_id, full_name, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new AppError(403, 'FORBIDDEN', 'User profile not found');
  }

  const allowedRoles: UserRole[] = [
    'citizen',
    'employee',
    'department_manager',
    'admin',
  ];

  if (!allowedRoles.includes(profile.role as UserRole)) {
    throw new AppError(403, 'FORBIDDEN', 'User role is not supported');
  }

  if (profile.is_active !== true) {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Your account is inactive');
  }

  req.user = {
    id: authData.user.id,
    email: authData.user.email,
    role: profile.role as UserRole,
    department_id: profile.department_id ?? null,
    full_name: profile.full_name ?? null,
    is_active: profile.is_active,
  };

  req.token = token;

  next();
}
