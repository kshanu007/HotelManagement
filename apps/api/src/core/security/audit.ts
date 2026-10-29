import type { ClientSession } from 'mongoose';
import type { SessionUser } from '@annapurna/types';
import { AuditLog } from '../database/models.js';
export async function audit(
  user: SessionUser,
  action: string,
  resource: string,
  recordId: string,
  details: unknown,
  session?: ClientSession,
) {
  await AuditLog.create(
    [{ tenantId: user.tenantId, userId: user.id, action, resource, recordId, details }],
    { session },
  );
}
