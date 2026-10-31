import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import crypto from 'node:crypto';
import { validate } from '../../middleware/validate.js';
import { loginSchema, createUserSchema, promoteUserParamsSchema, promoteUserBodySchema } from './schema.js';
import { loginWithIdentifier, createManagedUser, promoteUser } from './service.js';

import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/require-role.js';

export const authRouter = Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again later.',
    },
  },
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please try again later.',
        requestId: req.id || crypto.randomUUID(),
      },
    });
  },
});

// POST /v1/auth/login
// Accepts email, Egyptian national ID, or Egyptian mobile number plus password.
// The email lookup and password verification happen server-side; email is never
// returned by a lookup-only endpoint.
authRouter.post('/login', loginRateLimiter, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const result = await loginWithIdentifier(req.body);
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /v1/auth/users
// Only an authenticated administrator may create non-admin accounts.
authRouter.post(
  '/users',
  requireAuth,
  requireRole('admin'),
  validate({ body: createUserSchema }),
  async (req, res, next) => {
    try {
      const result = await createManagedUser(req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /v1/auth/users/:id/promote
// Only an authenticated administrator may promote an employee to department manager.
authRouter.patch(
  '/users/:id/promote',
  requireAuth,
  requireRole('admin'),
  validate({ params: promoteUserParamsSchema, body: promoteUserBodySchema }),
  async (req, res, next) => {
    try {
      const result = await promoteUser(req.params.id as string, req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
