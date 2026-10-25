import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';
import type { AuthUser } from './auth.js';

export function requireRole(...allowedRoles: Array<AuthUser['role']>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication token required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Access denied: requires one of the following roles [${allowedRoles.join(', ')}]`,
      );
    }

    next();
  };
}
