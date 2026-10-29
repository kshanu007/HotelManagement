import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SessionUser } from '@annapurna/types';
import { ROLES } from '@annapurna/constants';
import {
  User,
  RefreshSession,
  RefreshFamily,
  Tenant,
  TenantSubscription,
  AuditLog,
} from '../../core/database/models.js';
import { ensure } from '../../core/errors/index.js';
import { env } from '../../config/env.js';
import { addDays, businessDate } from '../../shared/helpers/dates.js';
export const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export function present(user: Record<string, unknown>): SessionUser {
  return {
    id: String(user._id),
    name: String(user.name),
    email: String(user.email),
    role: user.role as SessionUser['role'],
    ...(user.tenantId ? { tenantId: String(user.tenantId) } : {}),
  };
}
export async function assertActive(user: Record<string, unknown>) {
  ensure(user.status === 'active', 403, 'FORBIDDEN', 'Account is inactive');
  if (user.role === ROLES.owner) {
    const hotel = await Tenant.findById(user.tenantId).lean();
    ensure(hotel?.status === 'active', 403, 'FORBIDDEN', 'Hotel is inactive or suspended');
  }
}
export async function assertEntitlement(user: SessionUser) {
  if (user.role !== ROLES.owner) return;
  const hotel = await Tenant.findById(user.tenantId).lean();
  const today = businessDate();
  const sub = await TenantSubscription.findOne({
    hotelId: user.tenantId,
    startDate: { $lte: today },
  })
    .sort({ endDate: -1 })
    .lean();
  ensure(
    sub && addDays(String(sub.endDate), Number(hotel?.graceDays ?? 0)) >= today,
    402,
    'SUBSCRIPTION_EXPIRED',
    'Your hotel subscription has expired. Contact the platform administrator.',
  );
}
export async function session(user: Record<string, unknown>, existingFamily?: string) {
  const familyId = existingFamily ?? randomUUID(),
    expiresAt = new Date(Date.now() + env.REFRESH_DAYS * 86400000);
  if (existingFamily) {
    const family = await RefreshFamily.findOneAndUpdate(
      { familyId, revokedAt: null },
      { $inc: { version: 1 }, $set: { expiresAt } },
      { new: true },
    );
    ensure(family, 401, 'UNAUTHORIZED', 'Session family revoked');
  } else await RefreshFamily.create({ familyId, userId: user._id, expiresAt });
  const token = randomBytes(48).toString('base64url');
  const record = await RefreshSession.create({
    userId: user._id,
    familyId,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + env.REFRESH_DAYS * 86400000),
  });
  return {
    user: present(user),
    accessToken: jwt.sign(
      { sub: String(user._id), version: user.passwordVersion, sid: String(record._id) },
      env.JWT_SECRET,
      { expiresIn: '15m', issuer: 'annapurna', audience: 'annapurna-web' },
    ),
    refreshToken: token,
  };
}
export async function login(email: string, password: string, ip?: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash').lean();
  const valid = await bcrypt.compare(
    password,
    (user?.passwordHash as string) ??
      '$2b$12$O7gK0b9GCq4vLP7u9vFoAeHTiqP9I2JQvMAzjcTgKPQvBEgtSpgBa',
  );
  await AuditLog.create({
    userId: user?._id,
    tenantId: user?.tenantId,
    action: valid ? 'login.success' : 'login.failed',
    ip,
  });
  ensure(user && valid, 401, 'UNAUTHORIZED', 'Invalid email or password');
  await assertActive(user);
  return session(user);
}
export async function rotate(token: string) {
  const old = await RefreshSession.findOne({ tokenHash: hash(token) }).lean();
  ensure(old, 401, 'UNAUTHORIZED', 'Session expired');
  if (old.usedAt || old.revokedAt) {
    await RefreshFamily.updateOne({ familyId: old.familyId }, { $set: { revokedAt: new Date() } });
    await RefreshSession.updateMany(
      { familyId: old.familyId },
      { $set: { revokedAt: new Date() } },
    );
    ensure(false, 401, 'UNAUTHORIZED', 'Session reuse detected');
  }
  ensure(
    new Date(old.expiresAt as Date).getTime() > Date.now(),
    401,
    'UNAUTHORIZED',
    'Session expired',
  );
  ensure(
    await RefreshFamily.exists({ familyId: old.familyId, revokedAt: null }),
    401,
    'UNAUTHORIZED',
    'Session family revoked',
  );
  const claimed = await RefreshSession.findOneAndUpdate(
    { _id: old._id, usedAt: null, revokedAt: null },
    { $set: { usedAt: new Date() } },
  );
  ensure(claimed, 401, 'UNAUTHORIZED', 'Session already used');
  const user = await User.findById(old.userId).lean();
  ensure(user, 401, 'UNAUTHORIZED', 'Account unavailable');
  await assertActive(user);
  return session(user, String(old.familyId));
}
