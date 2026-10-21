import { rateLimit } from 'express-rate-limit';
import crypto from 'node:crypto';

export const basicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
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
