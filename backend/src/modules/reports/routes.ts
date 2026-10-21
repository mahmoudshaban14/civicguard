import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listReportsQuerySchema } from './schema.js';
import { listReports } from './service.js';

export const reportsRouter = Router();

// GET /v1/reports?mine=1
reportsRouter.get(
  '/',
  requireAuth,
  validate({ query: listReportsQuerySchema }),
  async (req, res, next) => {
    try {
      const reports = await listReports(
        req.user!,
        req.query as unknown as import('./schema.js').ListReportsQuery,
      );
      res.json({ reports });
    } catch (err) {
      next(err);
    }
  },
);
