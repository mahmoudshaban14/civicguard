import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { analyzeReportSchema, type AnalyzeReportInput } from './schema.js';
import { analyzeReportImage } from './service.js';

export const analysisRouter = Router();

// POST /v1/reports/analyze  -> Gemini looks at the uploaded photo
analysisRouter.post(
  '/',
  requireAuth,
  validate({ body: analyzeReportSchema }),
  async (req, res, next) => {
    try {
      const analysis = await analyzeReportImage(req.user!, req.body as AnalyzeReportInput);
      res.status(200).json(analysis);
    } catch (err) {
      next(err);
    }
  },
);
