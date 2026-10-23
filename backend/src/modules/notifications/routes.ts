import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listNotificationsQuerySchema,
  markNotificationsReadSchema,
} from './schema.js';
import { listNotifications, markNotificationsRead } from './service.js';

export const notificationsRouter = Router();

// GET /v1/notifications
notificationsRouter.get(
  '/',
  requireAuth,
  validate({ query: listNotificationsQuerySchema }),
  async (req, res, next) => {
    try {
      const notifications = await listNotifications(
        req.user!,
        req.query as unknown as import('./schema.js').ListNotificationsQuery,
      );
      res.json({ notifications });
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/notifications/read
notificationsRouter.post(
  '/read',
  requireAuth,
  validate({ body: markNotificationsReadSchema }),
  async (req, res, next) => {
    try {
      const result = await markNotificationsRead(req.user!, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
