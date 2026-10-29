import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../core/errors/index.js';
import { logger } from '../config/logger.js';
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON' },
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the supplied values',
        details: error.issues,
      },
    });
    return;
  }
  if (error?.code === 11000) {
    res
      .status(409)
      .json({ success: false, error: { code: 'CONFLICT', message: 'This record already exists' } });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }
  logger.error({ err: error }, 'Request failed');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Unable to complete this request' },
  });
};
