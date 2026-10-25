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

  // Query profile: try full schema (with department_id, full_name), fallback to id, role if pre-migration
  let profile: { id: string; role?: string; department_id?: string | null; full_name?: string | null } | null = null;
  const { data: adminProfile, error: pError } = await supabase
    .from('profiles')
    .select('id, role, department_id, full_name')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (pError || !adminProfile) {
    const { createScopedClient } = await import('../db/client.js');
    const userClient = createScopedClient(token);
    const { data: userScopedProfile, error: uError } = await userClient
      .from('profiles')
      .select('id, role, department_id, full_name')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (uError) {
      // Fallback for un-migrated database without department_id/full_name
      const { data: legacyProfile } = await userClient
        .from('profiles')
        .select('id, role')
        .eq('id', authData.user.id)
        .maybeSingle();
      profile = legacyProfile;
    } else {
      profile = userScopedProfile;
    }
  } else {
    profile = adminProfile;
  }

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
