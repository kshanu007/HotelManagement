import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_RESPONSE } from '@annapurna/constants';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { loginSchema, password } from '@annapurna/validation';
import { env } from '../../config/env.js';
import { login, rotate, hash } from './service.js';
import { authenticate } from '../../middleware/auth.js';
import { User, RefreshSession, RefreshFamily, AuditLog } from '../../core/database/models.js';
import { ensure } from '../../core/errors/index.js';
import { asyncRoute } from '../../shared/helpers/http.js';
export const authRouter = Router();
const cookie = 'annapurna_refresh';
const options = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: env.REFRESH_DAYS * 86400000,
};
const { maxAge: _maxAge, ...clearOptions } = options;
function send(res: Response, result: Awaited<ReturnType<typeof login>>) {
  res
    .cookie(cookie, result.refreshToken, options)
    .json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
}
authRouter.use(
  rateLimit({
    message: RATE_LIMIT_RESPONSE,
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);
authRouter.post(
  '/login',
  asyncRoute(async (req, res) => {
    const data = loginSchema.parse(req.body);
    send(res, await login(data.email, data.password, req.ip));
  }),
);
authRouter.post(
  '/refresh',
  asyncRoute(async (req, res) => {
    ensure(typeof req.cookies[cookie] === 'string', 401, 'UNAUTHORIZED', 'Please sign in');
    send(res, await rotate(req.cookies[cookie]));
  }),
);
authRouter.post(
  '/logout',
  asyncRoute(async (req, res) => {
    if (typeof req.cookies[cookie] === 'string') {
      const old = await RefreshSession.findOne({ tokenHash: hash(req.cookies[cookie]) }).lean();
      if (old) {
        await RefreshFamily.updateOne(
          { familyId: old.familyId },
          { $set: { revokedAt: new Date() } },
        );
        await RefreshSession.updateMany(
          { familyId: old.familyId },
          { $set: { revokedAt: new Date() } },
        );
      }
    }
    res.clearCookie(cookie, clearOptions).json({ success: true, data: null });
  }),
);
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});
authRouter.post(
  '/forgot-password',
  asyncRoute(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).strict().parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await User.updateOne(
        { _id: user._id },
        { $set: { resetHash: hash(token), resetExpires: new Date(Date.now() + 30 * 60000) } },
      );
      await AuditLog.create({
        userId: user._id,
        action: 'password.reset.requested',
      }); /* Delivery is deliberately external: use the administrator reset-link CLI until SMTP is configured. */
    }
    res.json({
      success: true,
      data: null,
      message: 'If the account exists, contact your administrator for a reset link.',
    });
  }),
);
authRouter.post(
  '/reset-password',
  asyncRoute(async (req, res) => {
    const data = z
      .object({ token: z.string().min(20), password })
      .strict()
      .parse(req.body);
    const user = await User.findOneAndUpdate(
      { resetHash: hash(data.token), resetExpires: { $gt: new Date() } },
      {
        $set: { passwordHash: await bcrypt.hash(data.password, 12) },
        $unset: { resetHash: 1, resetExpires: 1 },
        $inc: { passwordVersion: 1 },
      },
    );
    ensure(user, 400, 'INVALID_RESET', 'Reset link is invalid or expired');
    await RefreshFamily.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
    await AuditLog.create({
      userId: user._id,
      tenantId: user.tenantId,
      action: 'credentials.changed',
    });
    await RefreshSession.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
    res.json({ success: true, data: null });
  }),
);
authRouter.post(
  '/change-password',
  authenticate,
  asyncRoute(async (req, res) => {
    const data = z
      .object({ currentPassword: z.string().min(1), password })
      .strict()
      .parse(req.body);
    const user = await User.findById(req.user.id).select('+passwordHash');
    ensure(
      user && (await bcrypt.compare(data.currentPassword, String(user.passwordHash))),
      400,
      'INVALID_PASSWORD',
      'Current password is incorrect',
    );
    await User.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash: await bcrypt.hash(data.password, 12) },
        $inc: { passwordVersion: 1 },
      },
    );
    await RefreshFamily.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
    await AuditLog.create({
      userId: user._id,
      tenantId: user.tenantId,
      action: 'credentials.changed',
    });
    await RefreshSession.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
    res.clearCookie(cookie, clearOptions).json({ success: true, data: null });
  }),
);
authRouter.post(
  '/revoke-sessions',
  authenticate,
  asyncRoute(async (req, res) => {
    await User.updateOne({ _id: req.user.id }, { $inc: { passwordVersion: 1 } });
    await RefreshFamily.updateMany({ userId: req.user.id }, { $set: { revokedAt: new Date() } });
    await AuditLog.create({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      action: 'sessions.revoked',
    });
    await RefreshSession.updateMany({ userId: req.user.id }, { $set: { revokedAt: new Date() } });
    res.clearCookie(cookie, clearOptions).json({ success: true, data: null });
  }),
);
