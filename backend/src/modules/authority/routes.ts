import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/require-role.js';
import { validate } from '../../middleware/validate.js';
import {
  authorityReportsQuerySchema,
  reportIdParamsSchema,
  updateReportStatusSchema,
  assignReportDepartmentSchema,
  updateReportActionStatusSchema,
} from './schema.js';
import { listReportDuplicates } from '../duplicates/service.js';
import {
  listAuthorityReports,
  updateReportStatus,
  assignReportDepartment,
  updateReportActionStatus,
} from './service.js';

export const authorityRouter = Router();

// Restrict all routes in this router to 'authority' or 'admin'
authorityRouter.use(requireAuth, requireRole('authority', 'admin'));

// GET /v1/authority/reports?status&severity&department_id
authorityRouter.get(
  '/reports',
  validate({ query: authorityReportsQuerySchema }),
  async (req, res, next) => {
    try {
      const reports = await listAuthorityReports(
        req.user!,
        req.query as unknown as import('./schema.js').AuthorityReportsQuery,
      );
      res.json({ reports });
    } catch (err) {
      next(err);
    }
  },
);

// GET /v1/authority/reports/:id/duplicates  (admin-only information, never shown to citizens)
authorityRouter.get(
  '/reports/:id/duplicates',
  validate({ params: reportIdParamsSchema }),
  async (req, res, next) => {
    try {
      const duplicates = await listReportDuplicates(req.user!, req.params.id as string);
      res.json({ duplicates });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /v1/authority/reports/:id/status
authorityRouter.patch(
  '/reports/:id/status',
  validate({ params: reportIdParamsSchema, body: updateReportStatusSchema }),
  async (req, res, next) => {
    try {
      const updated = await updateReportStatus(
        req.user!,
        req.params.id as string,
        req.body,
      );
      res.json({ report: updated });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /v1/authority/reports/:id/action-status
authorityRouter.patch(
  '/reports/:id/action-status',
  validate({ params: reportIdParamsSchema, body: updateReportActionStatusSchema }),
  async (req, res, next) => {
    try {
      const updated = await updateReportActionStatus(
        req.user!,
        req.params.id as string,
        req.body,
      );
      res.json({ report: updated });
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/authority/reports/:id/assign
authorityRouter.post(
  '/reports/:id/assign',
  validate({ params: reportIdParamsSchema, body: assignReportDepartmentSchema }),
  async (req, res, next) => {
    try {
      const updated = await assignReportDepartment(
        req.user!,
        req.params.id as string,
        req.body,
      );
      res.json({ report: updated });
    } catch (err) {
      next(err);
    }
  },
);

