import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import crypto from 'node:crypto';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existingId = req.headers['x-request-id'];
  const requestId = Array.isArray(existingId)
    ? existingId[0]
    : existingId || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  const requestId = req.id || crypto.randomUUID();

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.flatten(),
        requestId,
      },
    });
    return;
  }

  const message =
    err instanceof Error ? err.message : 'An unexpected internal error occurred';
  const statusCode =
    typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
      ? err.status
      : 500;

  res.status(statusCode).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: statusCode === 500 && process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : message,
      requestId,
    },
  });
}
