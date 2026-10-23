import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { signUploadSchema } from './schema.js';
import { createSignedUploadUrl } from './service.js';

export const uploadsRouter = Router();

// POST /v1/uploads/sign
uploadsRouter.post(
  '/sign',
  requireAuth,
  validate({ body: signUploadSchema }),
  async (req, res, next) => {
    try {
      const uploadDetails = await createSignedUploadUrl(
        req.user!,
        req.body as import('./schema.js').SignUploadInput,
      );
      res.status(200).json(uploadDetails);
    } catch (err) {
      next(err);
    }
  },
);
