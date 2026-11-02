import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/require-role.js';
import { validate } from '../../middleware/validate.js';
import {
  listWorkOrdersQuerySchema,
  createWorkOrderSchema,
  workOrderIdParamsSchema,
  assignWorkOrderSchema,
  submitCompletionSchema,
  reviewWorkOrderSchema,
  cancelWorkOrderSchema,
} from './schema.js';
import {
  listWorkOrders,
  createWorkOrder,
  assignWorkOrder,
  startWorkOrder,
  submitCompletion,
  reviewWorkOrder,
  cancelWorkOrder,
} from './service.js';

export const workOrdersRouter = Router();

workOrdersRouter.use(requireAuth);

// GET /v1/work-orders
workOrdersRouter.get(
  '/',
  validate({ query: listWorkOrdersQuerySchema }),
  async (req, res, next) => {
    try {
      const result = await listWorkOrders(
        req.user!,
        req.query as unknown as import('./schema.js').ListWorkOrdersQuery,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders
workOrdersRouter.post(
  '/',
  requireRole('admin', 'department_manager'),
  validate({ body: createWorkOrderSchema }),
  async (req, res, next) => {
    try {
      const id = await createWorkOrder(req.user!, req.body);
      res.status(201).json({ id, message: 'Work Order created successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/assign
workOrdersRouter.post(
  '/:id/assign',
  requireRole('admin', 'department_manager'),
  validate({ params: workOrderIdParamsSchema, body: assignWorkOrderSchema }),
  async (req, res, next) => {
    try {
      await assignWorkOrder(req.user!, req.params.id as string, req.body);
      res.json({ message: 'Work Order assigned successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/start
workOrdersRouter.post(
  '/:id/start',
  requireRole('employee'),
  validate({ params: workOrderIdParamsSchema }),
  async (req, res, next) => {
    try {
      await startWorkOrder(req.user!, req.params.id as string);
      res.json({ message: 'Work Order started successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/complete
workOrdersRouter.post(
  '/:id/complete',
  requireRole('employee'),
  validate({ params: workOrderIdParamsSchema, body: submitCompletionSchema }),
  async (req, res, next) => {
    try {
      await submitCompletion(req.user!, req.params.id as string, req.body);
      res.json({ message: 'Completion submitted for review' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/review
workOrdersRouter.post(
  '/:id/review',
  requireRole('admin', 'department_manager'),
  validate({ params: workOrderIdParamsSchema, body: reviewWorkOrderSchema }),
  async (req, res, next) => {
    try {
      await reviewWorkOrder(req.user!, req.params.id as string, req.body);
      res.json({ message: 'Work Order review submitted successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/cancel
workOrdersRouter.post(
  '/:id/cancel',
  requireRole('admin', 'department_manager'),
  validate({ params: workOrderIdParamsSchema, body: cancelWorkOrderSchema }),
  async (req, res, next) => {
    try {
      await cancelWorkOrder(req.user!, req.params.id as string, req.body);
      res.json({ message: 'Work Order cancelled successfully' });
    } catch (err) {
      next(err);
    }
  },
);