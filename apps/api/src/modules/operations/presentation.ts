import mongoose from 'mongoose';
import type { SessionUser } from '@annapurna/types';
import { repository } from '../../core/tenancy/repository.js';
import type { Resource } from '../../core/database/models.js';
export async function enrichRecords(
  user: SessionUser,
  resource: Resource,
  rows: Record<string, unknown>[],
) {
  const mapping: Record<string, Resource> = {
    customerId: 'customers',
    vendorId: 'vendors',
    hotelId: 'hotels',
    planId: resource.startsWith('saas-') ? 'saas-plans' : 'mess-plans',
    categoryId: resource === 'vendors' ? 'vendor-categories' : 'expense-categories',
    partyId: resource.startsWith('saas-')
      ? 'hotels'
      : resource.startsWith('vendor-')
        ? 'vendors'
        : 'customers',
  };
  const labels: Record<string, Record<string, string>> = {};
  await Promise.all(
    Object.entries(mapping).map(async ([field, target]) => {
      const ids = [
        ...new Set(
          rows.map((r) => String(r[field] ?? '')).filter((v) => mongoose.isValidObjectId(v)),
        ),
      ];
      if (!ids.length) return;
      const records = await repository(user, target)
        .find({ _id: { $in: ids } })
        .select('name planName customerCode')
        .lean();
      labels[field] = Object.fromEntries(
        records.map((r) => [String(r._id), String(r.name ?? r.planName ?? r._id)]),
      );
    }),
  );
  return rows.map((row) => ({
    ...row,
    displayLabels: Object.fromEntries(
      Object.entries(labels).flatMap(([field, values]) =>
        values[String(row[field])] ? [[field, values[String(row[field])]]] : [],
      ),
    ),
  }));
}
