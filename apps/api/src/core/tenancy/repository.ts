import { Types, type FilterQuery, type Model } from 'mongoose';
import { PLATFORM_RESOURCES, ROLES } from '@annapurna/constants';
import type { SessionUser } from '@annapurna/types';
import { resources, type Resource, type DatabaseRecord } from '../database/models.js';
import { ensure } from '../errors/index.js';
export function isPlatform(resource: Resource) {
  return (PLATFORM_RESOURCES as readonly string[]).includes(resource);
}
export function scope(user: SessionUser, resource: Resource): FilterQuery<unknown> {
  if (isPlatform(resource)) {
    ensure(user.role === ROLES.admin, 403, 'FORBIDDEN', 'Platform administrator required');
    return {};
  }
  ensure(
    user.role === ROLES.owner && user.tenantId,
    403,
    'FORBIDDEN',
    'Hotel owner context required',
  );
  return { tenantId: new Types.ObjectId(user.tenantId), deletedAt: null, voidedAt: null };
}
export function repository(user: SessionUser, resource: Resource) {
  const filter = scope(user, resource);
  const model: Model<DatabaseRecord> = resources[resource];
  return {
    model,
    filter,
    find: (extra: FilterQuery<unknown> = {}) => model.find({ ...extra, ...filter }),
    one: (id: string) => model.findOne({ ...filter, _id: id }),
    aggregate: (pipeline: Parameters<Model<DatabaseRecord>['aggregate']>[0]) =>
      model.aggregate([{ $match: filter }, ...(pipeline ?? [])]),
  };
}
