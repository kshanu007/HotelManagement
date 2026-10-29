import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { User, RefreshSession, RefreshFamily } from '../core/database/models.js';
import { env } from '../config/env.js';
import { AppError, ensure } from '../core/errors/index.js';
import { assertActive, present } from '../modules/auth/service.js';
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    ensure(token, 401, 'UNAUTHORIZED', 'Please sign in');
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'annapurna',
        audience: 'annapurna-web',
      }) as jwt.JwtPayload;
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Access token expired');
    }
    const [user, session] = await Promise.all([
      User.findById(payload.sub).lean(),
      RefreshSession.findById(payload.sid).lean(),
    ]);
    ensure(
      session && !session.revokedAt && String(session.userId) === payload.sub,
      401,
      'UNAUTHORIZED',
      'Session revoked',
    );
    ensure(
      await RefreshFamily.exists({ familyId: session.familyId, revokedAt: null }),
      401,
      'UNAUTHORIZED',
      'Session revoked',
    );
    ensure(
      user && user.passwordVersion === payload.version,
      401,
      'UNAUTHORIZED',
      'Session revoked',
    );
    await assertActive(user);
    req.user = present(user);
    next();
  } catch (e) {
    next(e);
  }
};
export const originGuard: RequestHandler = (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== env.WEB_ORIGIN)
    return next(new AppError(403, 'CSRF_REJECTED', 'Request origin is not allowed'));
  next();
};
