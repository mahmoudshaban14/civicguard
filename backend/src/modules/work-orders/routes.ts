import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  workOrderIdParamSchema,
  listWorkOrdersQuerySchema,
  createWorkOrderSchema,
  assignWorkOrderSchema,
  submitWorkOrderCompletionSchema,
  signEvidenceUploadSchema,
  reviewWorkOrderSchema,
  cancelWorkOrderSchema,
} from './schema.js';
import {
  listWorkOrders,
  getWorkOrderById,
  getWorkOrderEvents,
  createWorkOrder,
  assignWorkOrder,
  startWorkOrder,
  createEvidenceUploadUrl,
  submitWorkOrderCompletion,
  reviewWorkOrder,
  cancelWorkOrder,
} from './service.js';

export const workOrdersRouter = Router();

// All work-orders endpoints require authentication.
workOrdersRouter.use(requireAuth);

// GET /v1/work-orders
workOrdersRouter.get(
  '/',
  validate({ query: listWorkOrdersQuerySchema }),
  async (req, res, next) => {
    try {
      const workOrders = await listWorkOrders(
        req.user!,
        req.query as unknown as import('./schema.js').ListWorkOrdersQuery,
      );
      res.json({ work_orders: workOrders });
    } catch (err) {
      next(err);
    }
  },
);

// GET /v1/work-orders/:id
workOrdersRouter.get(
  '/:id',
  validate({ params: workOrderIdParamSchema }),
  async (req, res, next) => {
    try {
      const workOrder = await getWorkOrderById(req.user!, req.params.id as string);
      res.json({ work_order: workOrder });
    } catch (err) {
      next(err);
    }
  },
);

// GET /v1/work-orders/:id/events
workOrdersRouter.get(
  '/:id/events',
  validate({ params: workOrderIdParamSchema }),
  async (req, res, next) => {
    try {
      const events = await getWorkOrderEvents(req.user!, req.params.id as string);
      res.json({ events });
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders
workOrdersRouter.post(
  '/',
  validate({ body: createWorkOrderSchema }),
  async (req, res, next) => {
    try {
      const result = await createWorkOrder(req.user!, req.body);
      res.status(201).json({ work_order_id: result.id });
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/assign
workOrdersRouter.post(
  '/:id/assign',
  validate({ params: workOrderIdParamSchema, body: assignWorkOrderSchema }),
  async (req, res, next) => {
    try {
      const result = await assignWorkOrder(
        req.user!,
        req.params.id as string,
        req.body,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/start
workOrdersRouter.post(
  '/:id/start',
  validate({ params: workOrderIdParamSchema }),
  async (req, res, next) => {
    try {
      const result = await startWorkOrder(req.user!, req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/evidence/sign
workOrdersRouter.post(
  '/:id/evidence/sign',
  validate({ params: workOrderIdParamSchema, body: signEvidenceUploadSchema }),
  async (req, res, next) => {
    try {
      const result = await createEvidenceUploadUrl(
        req.user!,
        req.params.id as string,
        req.body,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/submit
workOrdersRouter.post(
  '/:id/submit',
  validate({
    params: workOrderIdParamSchema,
    body: submitWorkOrderCompletionSchema,
  }),
  async (req, res, next) => {
    try {
      const result = await submitWorkOrderCompletion(
        req.user!,
        req.params.id as string,
        req.body,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/review
workOrdersRouter.post(
  '/:id/review',
  validate({ params: workOrderIdParamSchema, body: reviewWorkOrderSchema }),
  async (req, res, next) => {
    try {
      const result = await reviewWorkOrder(
        req.user!,
        req.params.id as string,
        req.body,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/work-orders/:id/cancel
workOrdersRouter.post(
  '/:id/cancel',
  validate({ params: workOrderIdParamSchema, body: cancelWorkOrderSchema }),
  async (req, res, next) => {
    try {
      const result = await cancelWorkOrder(
        req.user!,
        req.params.id as string,
        req.body,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

