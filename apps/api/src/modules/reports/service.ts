import mongoose, { type PipelineStage } from 'mongoose';
import type { SessionUser } from '@annapurna/types';
import { ROLES, REPORTS } from '@annapurna/constants';
import { date, id } from '@annapurna/validation';
import { z } from 'zod';
import {
  type Resource,
  CustomerCreditLedger,
  TenantSubscription,
} from '../../core/database/models.js';
import { repository } from '../../core/tenancy/repository.js';
import { ensure } from '../../core/errors/index.js';
import { localToday } from '../operations/service.js';
import { accrualStages } from './accrual.js';
import { flowStages } from './flows.js';
import { periodDates } from '../../shared/helpers/dates.js';
export const filterSchema = z
  .object({
    preset: z
      .enum([
        'today',
        'yesterday',
        'this-week',
        'last-week',
        'this-month',
        'last-month',
        'this-year',
        'last-year',
        'custom',
      ])
      .default('this-month'),
    from: date.optional(),
    to: date.optional(),
    customerId: id.optional(),
    vendorId: id.optional(),
    hotelId: id.optional(),
    planId: id.optional(),
    categoryId: id.optional(),
    method: z.enum(['cash', 'upi']).optional(),
    status: z.enum(['active', 'expired', 'upcoming']).optional(),
    groupBy: z.enum(['records', 'plan']).default('records'),
    accountStatus: z.enum(['active', 'inactive', 'suspended']).optional(),
    subscriptionStatus: z.enum(['active', 'expired']).optional(),
  })
  .refine(
    (d) => d.preset !== 'custom' || (d.from && d.to && d.from <= d.to),
    'Custom range requires valid start and end dates',
  );
const reportMap: Record<string, Resource> = {
  'customer-ledger': 'mess-invoices',
  'daily-sales': 'sales',
  'mess-collection': 'mess-payments',
  'mess-outstanding': 'mess-invoices',
  attendance: 'attendance',
  members: 'subscriptions',
  'vendor-purchases': 'purchases',
  'vendor-payments': 'vendor-payments',
  'vendor-outstanding': 'purchases',
  'vendor-ledger': 'purchases',
  expenses: 'expenses',
  income: 'mess-invoices',
  'profit-loss': 'mess-invoices',
  'cash-upi': 'mess-payments',
  'saas-revenue': 'saas-invoices',
  'hotel-registrations': 'hotels',
};
export async function reportContext(user: SessionUser, name: string, input: unknown) {
  ensure((REPORTS as readonly string[]).includes(name), 404, 'NOT_FOUND', 'Unknown report');
  ensure(
    user.role === ROLES.admin
      ? name.startsWith('saas-') || name === 'hotel-registrations'
      : !name.startsWith('saas-') && name !== 'hotel-registrations',
    403,
    'FORBIDDEN',
    'Report is not available for your role',
  );
  const filters = filterSchema.parse(input);
  const today = await localToday(user);
  const [from, to] =
    filters.preset === 'custom' ? [filters.from!, filters.to!] : periodDates(filters.preset, today);
  const resource = reportMap[name];
  const repo = repository(user, resource);
  const filter: Record<string, unknown> = { ...repo.filter };
  const allTime = name.endsWith('outstanding') || name === 'members';
  if (!allTime)
    filter[resource === 'hotels' ? 'createdAt' : 'date'] =
      resource === 'hotels'
        ? {
            $gte: new Date(`${from}T00:00:00+05:30`),
            $lt: new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400000),
          }
        : { $gte: from, $lte: to };
  for (const key of [
    'customerId',
    'vendorId',
    'hotelId',
    'planId',
    'categoryId',
    'method',
  ] as const)
    if (filters[key]) {
      const target =
        key === 'customerId' && ['mess-payments', 'mess-invoices'].includes(resource)
          ? 'partyId'
          : key === 'hotelId' && resource === 'saas-invoices'
            ? 'partyId'
            : key;
      filter[target] = key === 'method' ? filters[key] : new mongoose.Types.ObjectId(filters[key]);
    }
  const stages: PipelineStage[] = [{ $match: filter }];
  if (name === 'hotel-registrations') {
    if (filters.accountStatus) stages.push({ $match: { status: filters.accountStatus } });
    stages.push(
      {
        $lookup: {
          from: TenantSubscription.collection.name,
          let: { hotel: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$hotelId', '$$hotel'] }, { $lte: ['$startDate', today] }],
                },
              },
            },
            { $sort: { endDate: -1 } },
            { $limit: 1 },
            { $project: { endDate: 1 } },
          ],
          as: '_subscription',
        },
      },
      {
        $set: {
          subscriptionEnd: { $arrayElemAt: ['$_subscription.endDate', 0] },
          subscriptionStatus: {
            $cond: [
              { $gte: [{ $ifNull: [{ $arrayElemAt: ['$_subscription.endDate', 0] }, ''] }, today] },
              'active',
              'expired',
            ],
          },
        },
      },
      { $unset: '_subscription' },
    );
    if (filters.subscriptionStatus)
      stages.push({ $match: { subscriptionStatus: filters.subscriptionStatus } });
  }
  if (name.endsWith('outstanding'))
    stages.push(
      {
        $addFields: {
          outstandingPaise: {
            $max: [
              0,
              {
                $subtract: [
                  '$totalPaise',
                  { $add: ['$paidPaise', { $ifNull: ['$creditedPaise', 0] }] },
                ],
              },
            ],
          },
        },
      },
      { $match: { outstandingPaise: { $gt: 0 } } },
    );
  if (name === 'members')
    stages.push({
      $addFields: {
        status: {
          $cond: [
            { $and: [{ $lte: ['$startDate', today] }, { $gte: ['$endDate', today] }] },
            'active',
            { $cond: [{ $lt: ['$endDate', today] }, 'expired', 'upcoming'] },
          ],
        },
      },
    });
  if (name === 'members' && filters.status) stages.push({ $match: { status: filters.status } });
  if (name === 'saas-revenue') {
    const { date: _date, ...allPeriodFilter } = filter;
    stages.splice(
      0,
      stages.length,
      {
        $match: {
          ...allPeriodFilter,
          $or: [
            { serviceStart: { $lte: to }, serviceEnd: { $gte: from } },
            { serviceStart: { $exists: false }, date: { $gte: from, $lte: to } },
          ],
        },
      },
      ...accrualStages(from, to),
      {
        $set: {
          billedPaise: {
            $cond: [
              { $and: [{ $gte: ['$date', from] }, { $lte: ['$date', to] }] },
              '$totalPaise',
              0,
            ],
          },
        },
      },
    );
    if (filters.groupBy === 'plan')
      stages.push({
        $group: {
          _id: '$planId',
          planName: { $first: '$planName' },
          billedPaise: { $sum: '$billedPaise' },
          earnedPaise: { $sum: '$earnedPaise' },
        },
      });
  }
  return {
    repo,
    stages: flowStages(user, name, from, to, filters) ?? stages,
    filters,
    from,
    to,
    today,
  };
}
const numericFields = [
  'billedPaise',
  'incomePaise',
  'costPaise',
  'netPaise',
  'debitPaise',
  'creditPaise',
  'amountPaise',
  'totalPaise',
  'outstandingPaise',
  'dineInPaise',
  'parcelPaise',
  'otherPaise',
  'cashPaise',
  'upiPaise',
  'paidPaise',
  'creditedPaise',
  'earnedPaise',
];
export async function report(
  user: SessionUser,
  name: string,
  input: unknown,
  page = 1,
  limit = 20,
) {
  const ctx = await reportContext(user, name, input);
  const [result] = await ctx.repo.model.aggregate([
    ...ctx.stages,
    {
      $facet: {
        items: [
          { $sort: { createdAt: -1, _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        count: [{ $count: 'total' }],
        totals: [
          {
            $group: {
              _id: null,
              ...Object.fromEntries(
                numericFields.map((k) => [k, { $sum: { $ifNull: [`$${k}`, 0] } }]),
              ),
            },
          },
        ],
      },
    },
  ]);
  return {
    items: result.items,
    total: result.count[0]?.total ?? 0,
    totals: result.totals[0] ?? {},
    page,
    limit,
    from: ctx.from,
    to: ctx.to,
    basis: name.includes('outstanding')
      ? 'all-time balances'
      : 'service periods for earned revenue; invoice dates for billing; transaction dates for cash',
    ...(['income', 'profit-loss', 'cash-upi', 'vendor-ledger'].includes(name)
      ? { summary: await selectedSummary(user, name, ctx.from, ctx.to, ctx.filters) }
      : {}),
  };
}
async function selectedSummary(
  user: SessionUser,
  name: string,
  from: string,
  to: string,
  filters: z.infer<typeof filterSchema>,
) {
  const summary = await financialSummary(user, from, to, filters);
  const fields: Record<string, string[]> = {
    income: ['earnedMessPaise', 'hotelSalesPaise', 'earnedIncomePaise'],
    'profit-loss': [
      'earnedIncomePaise',
      'purchasesIncurredPaise',
      'expensesIncurredAndPaidPaise',
      'profitPaise',
    ],
    'cash-upi': ['cashCollectedPaise', 'upiCollectedPaise'],
    'vendor-ledger': ['purchasesIncurredPaise', 'vendorPaymentsPaise', 'vendorOutstandingPaise'],
  };
  return Object.fromEntries(
    fields[name].map((key) => [key, summary[key as keyof typeof summary] ?? 0]),
  );
}
async function total(
  user: SessionUser,
  resource: Resource,
  field: string,
  range?: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  const repo = repository(user, resource);
  const [r] = await repo.model.aggregate([
    { $match: { ...repo.filter, ...(range ? { date: range } : {}), ...extra } },
    { $group: { _id: null, value: { $sum: `$${field}` } } },
  ]);
  return Number(r?.value ?? 0);
}
async function earnedTotal(
  user: SessionUser,
  resource: 'mess-invoices' | 'saas-invoices',
  from: string,
  to: string,
  extra: Record<string, unknown> = {},
) {
  const repo = repository(user, resource);
  const [row] = await repo.model.aggregate([
    {
      $match: {
        ...repo.filter,
        ...extra,
        $or: [
          { serviceStart: { $lte: to }, serviceEnd: { $gte: from } },
          { serviceStart: { $exists: false }, date: { $gte: from, $lte: to } },
        ],
      },
    },
    ...accrualStages(from, to),
    { $group: { _id: null, value: { $sum: '$earnedPaise' } } },
  ]);
  return Number(row?.value ?? 0);
}
async function dues(user: SessionUser, resource: Resource, extra: Record<string, unknown> = {}) {
  const repo = repository(user, resource);
  const [r] = await repo.model.aggregate([
    { $match: { ...repo.filter, ...extra } },
    {
      $group: {
        _id: null,
        value: {
          $sum: {
            $max: [
              0,
              {
                $subtract: [
                  '$totalPaise',
                  { $add: ['$paidPaise', { $ifNull: ['$creditedPaise', 0] }] },
                ],
              },
            ],
          },
        },
      },
    },
  ]);
  return Number(r?.value ?? 0);
}
export async function financialSummary(
  user: SessionUser,
  from: string,
  to: string,
  filters: Partial<z.infer<typeof filterSchema>> = {},
) {
  const range = { $gte: from, $lte: to };
  if (user.role === ROLES.admin) {
    const invoices = await total(user, 'saas-invoices', 'totalPaise', range);
    const collections = await total(user, 'saas-payments', 'amountPaise', range);
    return {
      billedPaise: invoices,
      collectionsPaise: collections - (await total(user, 'saas-refunds', 'amountPaise', range)),
      earnedPaise: await earnedTotal(user, 'saas-invoices', from, to),
      outstandingPaise: await dues(user, 'saas-invoices'),
    };
  }
  const paymentFilter = {
    ...(filters.customerId ? { partyId: new mongoose.Types.ObjectId(filters.customerId) } : {}),
    ...(filters.method ? { method: filters.method } : {}),
  };
  const vendorFilter = filters.vendorId
    ? { vendorId: new mongoose.Types.ObjectId(filters.vendorId) }
    : {};
  const expenseFilter = {
    ...(filters.categoryId ? { categoryId: new mongoose.Types.ObjectId(filters.categoryId) } : {}),
    ...(filters.method ? { method: filters.method } : {}),
  };
  const [
    billed,
    collections,
    sales,
    expenses,
    purchases,
    vendorPaid,
    cashMess,
    upiMess,
    cashSales,
    upiSales,
  ] = await Promise.all([
    total(
      user,
      'mess-invoices',
      'totalPaise',
      range,
      filters.customerId ? { partyId: new mongoose.Types.ObjectId(filters.customerId) } : {},
    ),
    total(user, 'mess-payments', 'amountPaise', range, paymentFilter),
    total(user, 'sales', 'dineInPaise', range).then(
      async (n) =>
        n +
        (await total(user, 'sales', 'parcelPaise', range)) +
        (await total(user, 'sales', 'otherPaise', range)),
    ),
    total(user, 'expenses', 'amountPaise', range, expenseFilter),
    total(user, 'purchases', 'totalPaise', range, vendorFilter),
    total(user, 'vendor-payments', 'amountPaise', range, {
      ...(filters.vendorId ? { partyId: new mongoose.Types.ObjectId(filters.vendorId) } : {}),
      ...(filters.method ? { method: filters.method } : {}),
    }),
    total(user, 'mess-payments', 'amountPaise', range, { ...paymentFilter, method: 'cash' }),
    total(user, 'mess-payments', 'amountPaise', range, { ...paymentFilter, method: 'upi' }),
    total(user, 'sales', 'cashPaise', range),
    total(user, 'sales', 'upiPaise', range),
  ]);
  const messRefunds = await total(user, 'mess-refunds', 'amountPaise', range, paymentFilter);
  const vendorRefunds = await total(
    user,
    'vendor-refunds',
    'amountPaise',
    range,
    filters.vendorId ? { partyId: new mongoose.Types.ObjectId(filters.vendorId) } : {},
  );
  const creditAdjustments = await total(user, 'adjustments', 'amountPaise', range, {
    type: 'credit',
    ...(filters.customerId ? { customerId: new mongoose.Types.ObjectId(filters.customerId) } : {}),
  });
  const earned =
    (await earnedTotal(
      user,
      'mess-invoices',
      from,
      to,
      filters.customerId ? { partyId: new mongoose.Types.ObjectId(filters.customerId) } : {},
    )) - creditAdjustments;
  const cashRefunds = await total(user, 'mess-refunds', 'amountPaise', range, {
      ...paymentFilter,
      method: 'cash',
    }),
    upiRefunds = await total(user, 'mess-refunds', 'amountPaise', range, {
      ...paymentFilter,
      method: 'upi',
    });
  return {
    earnedMessPaise: earned,
    earnedIncomePaise: earned + sales,
    profitPaise: earned + sales - expenses - purchases,
    creditAdjustmentsPaise: creditAdjustments,
    billedMessPaise: billed,
    messCollectionsPaise: collections - messRefunds,
    hotelSalesPaise: sales,
    expensesIncurredAndPaidPaise: expenses,
    purchasesIncurredPaise: purchases,
    vendorPaymentsPaise: vendorPaid - vendorRefunds,
    billedIncomePaise: billed + sales,
    invoiceBasisProfitPaise: billed + sales - expenses - purchases,
    cashCollectedPaise: filters.method === 'upi' ? 0 : cashMess + cashSales - cashRefunds,
    upiCollectedPaise: filters.method === 'cash' ? 0 : upiMess + upiSales - upiRefunds,
    customerOutstandingPaise: await dues(user, 'mess-invoices'),
    vendorOutstandingPaise: await dues(user, 'purchases', vendorFilter),
  };
}
export async function dashboard(user: SessionUser) {
  const today = await localToday(user),
    month = `${today.slice(0, 7)}-01`;
  if (user.role === ROLES.admin) {
    const repo = repository(user, 'hotels');
    const [hotels, active, recent, summary] = await Promise.all([
      repo.model.countDocuments(),
      repo.model.countDocuments({ status: 'active' }),
      repo.find().sort({ createdAt: -1 }).limit(5).lean(),
      financialSummary(user, month, today),
    ]);
    return {
      today,
      kpis: {
        'Registered hotels': hotels,
        'Active hotels': active,
        'Expired hotels': await expiredCount(user, 'saas-subscriptions', today),
        ...summary,
      },
      recent,
      chart: await revenueChart(user, month, today),
    };
  }
  const [customers, active, lunch, dinner, summary, daily, credits] = await Promise.all([
    repository(user, 'customers').find().countDocuments(),
    repository(user, 'subscriptions').model.distinct('customerId', {
      ...repository(user, 'subscriptions').filter,
      startDate: { $lte: today },
      endDate: { $gte: today },
    }),
    repository(user, 'attendance')
      .find({ date: today, meal: 'lunch', status: 'present' })
      .countDocuments(),
    repository(user, 'attendance')
      .find({ date: today, meal: 'dinner', status: 'present' })
      .countDocuments(),
    financialSummary(user, month, today),
    financialSummary(user, today, today),
    CustomerCreditLedger.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(user.tenantId), kind: 'mess' } },
      { $group: { _id: null, value: { $sum: '$balancePaise' } } },
    ]),
  ]);
  return {
    today,
    kpis: {
      'Mess customers': customers,
      'Active members': active.length,
      'Expired members': await expiredCount(user, 'subscriptions', today),
      'Lunch today': lunch,
      'Dinner today': dinner,
      todayMessCollectionPaise: daily.messCollectionsPaise ?? 0,
      todayHotelSalesPaise: daily.hotelSalesPaise ?? 0,
      todayExpensesPaise: daily.expensesIncurredAndPaidPaise ?? 0,
      ...summary,
      customerAdvancesPaise: credits[0]?.value ?? 0,
    },
    daily,
    recent: await repository(user, 'mess-payments').find().sort({ createdAt: -1 }).limit(5).lean(),
    chart: await revenueChart(user, month, today),
  };
}
async function expiredCount(
  user: SessionUser,
  resource: 'subscriptions' | 'saas-subscriptions',
  today: string,
) {
  const repo = repository(user, resource);
  const field = resource === 'subscriptions' ? 'customerId' : 'hotelId';
  const [result] = await repo.model.aggregate([
    { $match: repo.filter },
    { $group: { _id: `$${field}`, endDate: { $max: '$endDate' } } },
    { $match: { endDate: { $lt: today } } },
    { $count: 'count' },
  ]);
  if (resource === 'saas-subscriptions') {
    const subscribed = await TenantSubscription.distinct('hotelId');
    return (
      Number(result?.count ?? 0) +
      (await repository(user, 'hotels').model.countDocuments({ _id: { $nin: subscribed } }))
    );
  }
  return Number(result?.count ?? 0);
}
async function revenueChart(user: SessionUser, from: string, to: string) {
  const repo = repository(user, user.role === ROLES.admin ? 'saas-payments' : 'mess-payments');
  return repo.model.aggregate([
    { $match: { ...repo.filter, date: { $gte: from, $lte: to } } },
    { $group: { _id: '$date', collectionsPaise: { $sum: '$amountPaise' } } },
    { $sort: { _id: 1 } },
  ]);
}
