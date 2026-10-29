import { rateLimit } from 'express-rate-limit';
import crypto from 'node:crypto';
import { config } from '../config.js';

export const basicRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX, // requests per IP per window (default 600 / 15 min)
  skip: (req) => req.path === '/health',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const requestId = req.id || crypto.randomUUID();
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
        requestId,
      },
    });
  },
});
