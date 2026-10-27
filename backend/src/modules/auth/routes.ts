import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import crypto from 'node:crypto';
import { validate } from '../../middleware/validate.js';
import { loginSchema } from './schema.js';
import { loginWithIdentifier } from './service.js';

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
