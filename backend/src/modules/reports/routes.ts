import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listReportsQuerySchema,
  createReportSchema,
  getReportParamsSchema,
} from './schema.js';
import { listReports, createReport, getReportById } from './service.js';

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

// POST /v1/reports
reportsRouter.post(
  '/',
  requireAuth,
  validate({ body: createReportSchema }),
  async (req, res, next) => {
    try {
      const report = await createReport(req.user!, req.body);
      res.status(201).json({ report });
    } catch (err) {
      next(err);
    }
  },
);

// GET /v1/reports/:id
reportsRouter.get(
  '/:id',
  requireAuth,
  validate({ params: getReportParamsSchema }),
  async (req, res, next) => {
    try {
      const result = await getReportById(req.user!, req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
