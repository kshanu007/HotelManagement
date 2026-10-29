import mongoose from 'mongoose';
import type { SessionUser } from '@annapurna/types';
import { schemas } from '@annapurna/validation';
import {
  resources,
  VendorPurchaseItem,
  CustomerCreditLedger,
  type Resource,
} from '../../core/database/models.js';
import { repository } from '../../core/tenancy/repository.js';
import { ensure } from '../../core/errors/index.js';
import { audit } from '../../core/security/audit.js';
import { purchaseTotal } from '../../shared/helpers/finance.js';
import { reconcileAccount } from './reconciliation.js';
export async function correctRecord(
  user: SessionUser,
  resource: 'expenses' | 'sales' | 'purchases',
  id: string,
  input: unknown,
) {
  const data = schemas[resource].parse(input);
  ensure(
    data.note.trim().length > 0,
    400,
    'REASON_REQUIRED',
    'Enter the correction reason in Note',
  );
  const repo = repository(user, resource);
  let result: unknown;
  await mongoose.connection.transaction(async (session) => {
    const original = await repo.one(id).session(session).lean();
    ensure(original, 404, 'NOT_FOUND', 'Record was not found or was already corrected');
    if (resource === 'expenses') {
      const category = await repository(user, 'expense-categories')
        .one(String((data as { categoryId: string }).categoryId))
        .session(session);
      ensure(category, 404, 'NOT_FOUND', 'Expense category not found');
    }
    let recordData: Record<string, unknown> = { ...data, tenantId: user.tenantId };
    if (resource === 'purchases') {
      const purchase = data as {
        vendorId: string;
        items: { name: string; quantity: number; unit: string; ratePaise: number }[];
      };
      const vendor = await repository(user, 'vendors').one(purchase.vendorId).session(session);
      ensure(vendor, 404, 'NOT_FOUND', 'Vendor not found');
      for (const vendorId of new Set([String(original.vendorId), purchase.vendorId]))
        await CustomerCreditLedger.findOneAndUpdate(
          { tenantId: user.tenantId, partyId: vendorId, kind: 'vendor' },
          { $inc: { version: 1 }, $setOnInsert: { balancePaise: 0 } },
          { upsert: true, session },
        );
      const { items: _items, ...rest } = recordData;
      recordData = {
        ...rest,
        totalPaise: purchaseTotal(purchase.items),
        paidPaise: 0,
        creditedPaise: 0,
      };
    }
    const [replacement] = await repo.model.create([recordData], { session });
    await repo.model.updateOne(
      { ...repo.filter, _id: id },
      { $set: { voidedAt: new Date(), supersededBy: replacement._id } },
      { session },
    );
    if (resource === 'purchases') {
      const purchase = data as {
        vendorId: string;
        items: { name: string; quantity: number; unit: string; ratePaise: number }[];
      };
      await VendorPurchaseItem.create(
        purchase.items.map((item) => ({
          ...item,
          tenantId: user.tenantId,
          purchaseId: replacement._id,
        })),
        { session },
      );
      for (const vendorId of new Set([String(original.vendorId), purchase.vendorId]))
        await reconcileAccount(user, vendorId, 'vendor', session);
    }
    await resources.corrections.create(
      [
        {
          tenantId: user.tenantId,
          resource,
          originalId: original._id,
          replacementId: replacement._id,
          reason: data.note,
          before: original,
        },
      ],
      { session },
    );
    await audit(
      user,
      'correction',
      resource,
      id,
      { replacementId: replacement._id, reason: data.note },
      session,
    );
    result = replacement.toObject();
  });
  return result;
}
export function isCorrectable(resource: Resource): resource is 'expenses' | 'sales' | 'purchases' {
  return ['expenses', 'sales', 'purchases'].includes(resource);
}
