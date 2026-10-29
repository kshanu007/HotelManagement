import mongoose, { type ClientSession } from 'mongoose';
import type { SessionUser } from '@annapurna/types';
import {
  resources,
  CustomerCreditLedger,
  MessAdjustment,
  type Resource,
} from '../../core/database/models.js';
import { repository } from '../../core/tenancy/repository.js';
import { ensure } from '../../core/errors/index.js';
export const ledgerResources = {
  mess: { invoice: 'mess-invoices', payment: 'mess-payments', refund: 'mess-refunds' },
  vendor: { invoice: 'purchases', payment: 'vendor-payments', refund: 'vendor-refunds' },
  saas: { invoice: 'saas-invoices', payment: 'saas-payments', refund: 'saas-refunds' },
} as const;
export type LedgerKind = keyof typeof ledgerResources;
/** Rebuild only derived balances. Original invoices, receipts, refunds and credits remain intact. */
export async function reconcileAccount(
  user: SessionUser,
  partyId: unknown,
  kind: LedgerKind,
  session: ClientSession,
) {
  const mapping = ledgerResources[kind],
    tenantId = kind === 'saas' ? partyId : user.tenantId;
  const match = (resource: Resource) => ({
    ...repository(user, resource).filter,
    partyId: new mongoose.Types.ObjectId(String(partyId)),
  });
  const sum = async (resource: Resource) => {
    const [row] = await resources[resource]
      .aggregate([
        { $match: match(resource) },
        { $group: { _id: null, amount: { $sum: '$amountPaise' } } },
      ])
      .session(session);
    return Number(row?.amount ?? 0);
  };
  let available = (await sum(mapping.payment)) - (await sum(mapping.refund));
  ensure(available >= 0, 409, 'INVALID_REFUND', 'Refunds exceed collections');
  const credits =
    kind === 'mess'
      ? await MessAdjustment.aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(String(tenantId)),
              customerId: new mongoose.Types.ObjectId(String(partyId)),
              type: 'credit',
            },
          },
          { $group: { _id: '$subscriptionId', amount: { $sum: '$amountPaise' } } },
        ]).session(session)
      : [];
  const creditMap = new Map(credits.map((row) => [String(row._id), Number(row.amount)]));
  const filter = {
    ...repository(user, mapping.invoice).filter,
    [kind === 'vendor' ? 'vendorId' : 'partyId']: partyId,
  };
  const cursor = resources[mapping.invoice]
    .find(filter)
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .session(session)
    .lean()
    .cursor();
  for await (const invoice of cursor) {
    const credited = Math.min(
      Number(invoice.totalPaise),
      creditMap.get(String(invoice.subscriptionId)) ?? 0,
    );
    const paid = Math.min(available, Number(invoice.totalPaise) - credited);
    available -= paid;
    await resources[mapping.invoice].updateOne(
      { ...filter, _id: invoice._id },
      { $set: { paidPaise: paid, creditedPaise: credited } },
      { session },
    );
  }
  await CustomerCreditLedger.updateOne(
    { tenantId, partyId, kind },
    { $set: { balancePaise: available } },
    { session },
  );
  return available;
}
