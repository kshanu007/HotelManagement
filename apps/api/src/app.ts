import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP, RATE_LIMIT_RESPONSE } from '@annapurna/constants';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errors.js';
import { authenticate, originGuard } from './middleware/auth.js';
import { authRouter } from './modules/auth/routes.js';
import { operationsRouter } from './modules/operations/routes.js';
import { reportRouter } from './modules/reports/routes.js';
import { assertEntitlement } from './modules/auth/service.js';
import { asyncRoute } from './shared/helpers/http.js';
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(
    rateLimit({
      message: RATE_LIMIT_RESPONSE,
      windowMs: 60000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/ready', (_req, res) => {
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({ database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable' });
  });
  app.use(APP.apiPrefix, originGuard);
  app.use(`${APP.apiPrefix}/auth`, authRouter);
  app.use(
    APP.apiPrefix,
    authenticate,
    asyncRoute(async (req, _res, next) => {
      if (!['/settings', '/audit', '/subscription-status'].includes(req.path))
        await assertEntitlement(req.user);
      next();
    }),
  );
  app.use(`${APP.apiPrefix}/reports`, reportRouter);
  app.use(APP.apiPrefix, operationsRouter);
  const webRoot = resolve(process.cwd(), 'apps/web/dist');
  if (env.NODE_ENV === 'production' && existsSync(resolve(webRoot, 'index.html'))) {
    app.use(express.static(webRoot));
    app.get('*', (req, res, next) => {
      if (req.path === '/api' || req.path.startsWith('/api/')) return next();
      res.sendFile(resolve(webRoot, 'index.html'));
    });
  }
  app.use((_req, res) => {
    res
      .status(404)
      .json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
  });
  app.use(errorHandler);
  return app;
}
