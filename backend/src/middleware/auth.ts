import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../db/client.js';
import { AppError } from './error-handler.js';
import { normalizeRole, type Role } from './roles.js';

export interface AuthUser {
  id: string;
  email?: string;
  role: Role;
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

  // Single authoritative profile lookup with the service-role client.
  // Fail closed: no profile, an unreadable profile, or an inactive account is rejected.
  // Requires the profiles.is_active migration (20261101210000) to be applied first.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, department_id, full_name, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    // A failed query is a server/DB problem (e.g. the is_active migration is not applied yet),
    // not a missing profile. Still fail closed, but say so and log the real cause.
    console.error(`[auth] profile lookup failed: ${profileError.message}`);
    throw new AppError(500, 'PROFILE_LOOKUP_FAILED', 'Could not load the user profile');
  }

  if (!profile) {
    throw new AppError(403, 'FORBIDDEN', 'User profile not found');
  }

  // is_active is NOT NULL DEFAULT true, so only an explicit false deactivates the account.
  if (profile.is_active === false) {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Your account is inactive');
  }

  req.user = {
    id: authData.user.id,
    email: authData.user.email,
    role: normalizeRole(profile.role),
    department_id: profile.department_id ?? null,
    full_name: profile.full_name ?? null,
  };
  req.token = token;

  next();
}
