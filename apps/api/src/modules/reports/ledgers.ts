import mongoose, { type PipelineStage } from 'mongoose';
import type { SessionUser } from '@annapurna/types';
import type { Resource } from '../../core/database/models.js';
import { repository } from '../../core/tenancy/repository.js';
export function ledgerStages(
  user: SessionUser,
  name: string,
  from: string,
  to: string,
  partyId?: string,
): PipelineStage[] {
  const vendor = name === 'vendor-ledger';
  const invoice = vendor ? 'purchases' : 'mess-invoices',
    payment = vendor ? 'vendor-payments' : 'mess-payments',
    refund = vendor ? 'vendor-refunds' : 'mess-refunds';
  const scope = (resource: Resource, field = 'partyId') => ({
    ...repository(user, resource).filter,
    date: { $lte: to },
    ...(partyId ? { [field]: new mongoose.Types.ObjectId(partyId) } : {}),
  });
  const union = (
    resource: Resource,
    pipeline: PipelineStage.UnionWithPipelineStage[],
  ): PipelineStage => ({
    $unionWith: { coll: repository(user, resource).model.collection.name, pipeline },
  });
  const stages: PipelineStage[] = [
    { $match: scope(invoice, vendor ? 'vendorId' : 'partyId') },
    {
      $project: {
        date: 1,
        createdAt: 1,
        partyId: vendor ? '$vendorId' : '$partyId',
        source: { $literal: vendor ? 'purchase' : 'invoice' },
        debitPaise: '$totalPaise',
        creditPaise: { $literal: 0 },
        note: { $ifNull: ['$note', '$description'] },
      },
    },
    union(payment, [
      { $match: scope(payment) },
      {
        $project: {
          date: 1,
          createdAt: 1,
          partyId: 1,
          source: { $literal: 'payment' },
          debitPaise: { $literal: 0 },
          creditPaise: '$amountPaise',
          note: 1,
        },
      },
    ]),
    union(refund, [
      { $match: scope(refund) },
      {
        $project: {
          date: 1,
          createdAt: 1,
          partyId: 1,
          source: { $literal: 'refund' },
          debitPaise: '$amountPaise',
          creditPaise: { $literal: 0 },
          note: 1,
        },
      },
    ]),
  ];
  if (!vendor)
    stages.push(
      union('adjustments', [
        { $match: { ...scope('adjustments', 'customerId'), type: 'credit' } },
        {
          $project: {
            date: 1,
            createdAt: 1,
            partyId: '$customerId',
            source: { $literal: 'credit adjustment' },
            debitPaise: { $literal: 0 },
            creditPaise: '$amountPaise',
            note: 1,
          },
        },
      ]),
    );
  stages.push(
    {
      $setWindowFields: {
        partitionBy: '$partyId',
        sortBy: { date: 1, createdAt: 1, _id: 1 },
        output: {
          balancePaise: {
            $sum: { $subtract: ['$debitPaise', '$creditPaise'] },
            window: { documents: ['unbounded', 'current'] },
          },
        },
      },
    },
    { $match: { date: { $gte: from } } },
  );
  return stages;
}
