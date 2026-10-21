import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../db/client.js';
import { AppError } from './error-handler.js';

export interface AuthUser {
  id: string;
  email?: string;
  role: 'citizen' | 'authority' | 'admin';
  department_id: string | null;
  full_name: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      user?: AuthUser;
      token?: string;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication token required');
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication token required');
  }

  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired authentication token');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, department_id, full_name')
    .eq('id', authData.user.id)
    .maybeSingle();

  req.user = {
    id: authData.user.id,
    email: authData.user.email,
    role: (profile?.role as 'citizen' | 'authority' | 'admin') || 'citizen',
    department_id: profile?.department_id || null,
    full_name: profile?.full_name || null,
  };
  req.token = token;

  next();
}
