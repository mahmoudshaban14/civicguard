import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { requestIdMiddleware, errorHandler } from './middleware/error-handler.js';
import { basicRateLimiter } from './middleware/rate-limit.js';
import { reportsRouter } from './modules/reports/routes.js';
import { uploadsRouter } from './modules/uploads/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { authorityRouter } from './modules/authority/routes.js';

export const app = express();

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = config.CORS_ORIGIN === '*'
  ? '*'
  : config.CORS_ORIGIN.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Request ID tracking
app.use(requestIdMiddleware);

// HTTP Logging (muted in test environment)
if (config.NODE_ENV !== 'test') {
  app.use(pinoHttp());
}

// Rate Limiting
app.use(basicRateLimiter);

// Parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// V1 Routes
app.use('/v1/reports', reportsRouter);
app.use('/v1/uploads', uploadsRouter);
app.use('/v1/notifications', notificationsRouter);
app.use('/v1/authority', authorityRouter);

// 404 Route Handler
app.use((req, res) => {
  const requestId = req.id;
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
      requestId,
    },
  });
});

// Central Error Handler
app.use(errorHandler);
