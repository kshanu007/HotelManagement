import mongoose, { type PipelineStage } from 'mongoose';
import type { SessionUser } from '@annapurna/types';
import { repository } from '../../core/tenancy/repository.js';
import type { Resource } from '../../core/database/models.js';
import { ledgerStages } from './ledgers.js';
import { accrualStages } from './accrual.js';
type Filters = { vendorId?: string; customerId?: string; method?: string; categoryId?: string };
export function flowStages(
  user: SessionUser,
  name: string,
  from: string,
  to: string,
  filters: Filters,
): PipelineStage[] | undefined {
  const scoped = (resource: Resource, extra: Record<string, unknown> = {}) => ({
    ...repository(user, resource).filter,
    date: { $gte: from, $lte: to },
    ...extra,
  });
  const union = (
    resource: Resource,
    pipeline: PipelineStage.UnionWithPipelineStage[],
  ): PipelineStage => ({
    $unionWith: { coll: repository(user, resource).model.collection.name, pipeline },
  });
  const selectedCustomer = filters.customerId
    ? { partyId: new mongoose.Types.ObjectId(filters.customerId) }
    : {};
  if (name === 'mess-collection' || name === 'vendor-payments') {
    const payment = name === 'mess-collection' ? 'mess-payments' : 'vendor-payments';
    const refund = name === 'mess-collection' ? 'mess-refunds' : 'vendor-refunds';
    const extra = {
      ...(name === 'mess-collection'
        ? selectedCustomer
        : filters.vendorId
          ? { partyId: new mongoose.Types.ObjectId(filters.vendorId) }
          : {}),
      ...(filters.method ? { method: filters.method } : {}),
    };
    return [
      { $match: scoped(payment, extra) },
      {
        $project: {
          date: 1,
          createdAt: 1,
          partyId: 1,
          receiptNo: 1,
          method: 1,
          note: 1,
          amountPaise: 1,
          source: { $literal: 'payment' },
        },
      },
      union(refund, [
        { $match: scoped(refund, extra) },
        {
          $project: {
            date: 1,
            createdAt: 1,
            partyId: 1,
            method: 1,
            note: 1,
            amountPaise: { $multiply: ['$amountPaise', -1] },
            source: { $literal: 'refund' },
          },
        },
      ]),
    ];
  }
  if (name === 'vendor-ledger' || name === 'customer-ledger')
    return ledgerStages(
      user,
      name,
      from,
      to,
      name === 'vendor-ledger' ? filters.vendorId : filters.customerId,
    );
  if (name === 'cash-upi') {
    const cashProject = (sign: number, source: string): PipelineStage.Project => ({
      $project: {
        date: 1,
        createdAt: 1,
        partyId: 1,
        source: { $literal: source },
        cashPaise: {
          $cond: [{ $eq: ['$method', 'cash'] }, { $multiply: ['$amountPaise', sign] }, 0],
        },
        upiPaise: {
          $cond: [{ $eq: ['$method', 'upi'] }, { $multiply: ['$amountPaise', sign] }, 0],
        },
      },
    });
    const extra = { ...selectedCustomer, ...(filters.method ? { method: filters.method } : {}) };
    return [
      { $match: scoped('mess-payments', extra) },
      cashProject(1, 'mess collection'),
      union('mess-refunds', [
        { $match: scoped('mess-refunds', extra) },
        cashProject(-1, 'customer refund'),
      ]),
      union('sales', [
        { $match: scoped('sales') },
        {
          $project: {
            date: 1,
            createdAt: 1,
            source: { $literal: 'hotel sale' },
            cashPaise: filters.method === 'upi' ? { $literal: 0 } : '$cashPaise',
            upiPaise: filters.method === 'cash' ? { $literal: 0 } : '$upiPaise',
          },
        },
      ]),
    ];
  }
  if (name === 'income' || name === 'profit-loss') {
    const invoiceFilter = {
      ...repository(user, 'mess-invoices').filter,
      ...selectedCustomer,
      $or: [
        { serviceStart: { $lte: to }, serviceEnd: { $gte: from } },
        { serviceStart: { $exists: false }, date: { $gte: from, $lte: to } },
      ],
    };
    const stages: PipelineStage[] = [
      { $match: invoiceFilter },
      ...accrualStages(from, to),
      {
        $project: {
          date: 1,
          createdAt: 1,
          partyId: 1,
          source: { $literal: 'mess earned revenue' },
          incomePaise: '$earnedPaise',
          costPaise: { $literal: 0 },
          netPaise: '$earnedPaise',
          description: 1,
        },
      },
      union('adjustments', [
        {
          $match: scoped('adjustments', {
            type: 'credit',
            ...(filters.customerId
              ? { customerId: new mongoose.Types.ObjectId(filters.customerId) }
              : {}),
          }),
        },
        {
          $project: {
            date: 1,
            createdAt: 1,
            partyId: '$customerId',
            source: { $literal: 'customer credit' },
            incomePaise: { $multiply: ['$amountPaise', -1] },
            costPaise: { $literal: 0 },
            netPaise: { $multiply: ['$amountPaise', -1] },
            description: '$note',
          },
        },
      ]),
      union('sales', [
        { $match: scoped('sales') },
        {
          $project: {
            date: 1,
            createdAt: 1,
            source: { $literal: 'hotel sale' },
            incomePaise: { $add: ['$dineInPaise', '$parcelPaise', '$otherPaise'] },
            costPaise: { $literal: 0 },
            netPaise: { $add: ['$dineInPaise', '$parcelPaise', '$otherPaise'] },
          },
        },
      ]),
    ];
    if (name === 'profit-loss')
      stages.push(
        union('purchases', [
          { $match: scoped('purchases') },
          {
            $project: {
              date: 1,
              createdAt: 1,
              partyId: '$vendorId',
              source: { $literal: 'vendor purchase' },
              incomePaise: { $literal: 0 },
              costPaise: '$totalPaise',
              netPaise: { $multiply: ['$totalPaise', -1] },
            },
          },
        ]),
        union('expenses', [
          { $match: scoped('expenses') },
          {
            $project: {
              date: 1,
              createdAt: 1,
              source: { $literal: 'operating expense' },
              incomePaise: { $literal: 0 },
              costPaise: '$amountPaise',
              netPaise: { $multiply: ['$amountPaise', -1] },
              description: 1,
            },
          },
        ]),
      );
    return stages;
  }
  return undefined;
}
