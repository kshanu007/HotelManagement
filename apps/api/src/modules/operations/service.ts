import mongoose, { type ClientSession, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { SessionUser } from '@annapurna/types';
import { schemas, customerEnrollmentSchema } from '@annapurna/validation';
import {
  resources,
  type Resource,
  type DatabaseRecord,
  User,
  Tenant,
  HotelSettings,
  CustomerCreditLedger,
  VendorPurchaseItem,
  Idempotency,
} from '../../core/database/models.js';
import { repository, isPlatform } from '../../core/tenancy/repository.js';
import { ensure } from '../../core/errors/index.js';
import { addDays, businessDate } from '../../shared/helpers/dates.js';
import { purchaseTotal, allocate } from '../../shared/helpers/finance.js';
import { correctRecord, isCorrectable } from './corrections.js';
import { audit } from '../../core/security/audit.js';
export { audit } from '../../core/security/audit.js';
import { hash } from '../auth/service.js';
import { reconcileAccount, ledgerResources, type LedgerKind } from './reconciliation.js';
type Data = Record<string, unknown>;
const immutable = new Set<Resource>([
  'mess-refunds',
  'vendor-refunds',
  'saas-refunds',
  'subscriptions',
  'saas-subscriptions',
  'mess-invoices',
  'saas-invoices',
  'mess-payments',
  'saas-payments',
  'vendor-payments',
  'purchases',
  'adjustments',
  'sales',
  'expenses',
]);
async function ref(user: SessionUser, resource: Resource, id: unknown, session: ClientSession) {
  const doc = await repository(user, resource).one(String(id)).session(session).lean();
  ensure(doc, 404, 'NOT_FOUND', `Referenced ${resource} record was not found`);
  return doc as Data;
}
async function account(tenantId: unknown, partyId: unknown, kind: string, session: ClientSession) {
  return CustomerCreditLedger.findOneAndUpdate(
    { tenantId, partyId, kind },
    { $inc: { version: 1 }, $setOnInsert: { balancePaise: 0 } },
    { upsert: true, new: true, session },
  );
}
async function applyCredit(
  model: Model<DatabaseRecord>,
  filter: Data,
  credit: number,
  session: ClientSession,
  creditField = 'paidPaise',
) {
  const docs = (await model
    .find(filter)
    .sort({ date: 1, createdAt: 1 })
    .session(session)
    .lean()) as Data[];
  const result = allocate(
    credit,
    docs.map((d) => ({
      id: String(d._id),
      due: Math.max(0, Number(d.totalPaise) - Number(d.paidPaise) - Number(d.creditedPaise ?? 0)),
    })),
  );
  for (const a of result.allocations)
    await model.updateOne(
      { _id: a.invoiceId, ...filter },
      { $inc: { [creditField]: a.amountPaise } },
      { session },
    );
  return result;
}
async function makeSubscription(
  user: SessionUser,
  resource: Resource,
  data: Data,
  session: ClientSession,
) {
  const platform = resource === 'saas-subscriptions';
  const party = await ref(
    user,
    platform ? 'hotels' : 'customers',
    data[platform ? 'hotelId' : 'customerId'],
    session,
  );
  ensure(party.status === 'active', 400, 'INACTIVE', 'Account is inactive');
  const plan = await ref(user, platform ? 'saas-plans' : 'mess-plans', data.planId, session);
  ensure(plan.status === 'active', 400, 'INACTIVE', 'Plan is inactive');
  const partyId = party._id;
  const model: Model<DatabaseRecord> = resources[resource];
  const filter = {
    ...repository(user, resource).filter,
    [platform ? 'hotelId' : 'customerId']: partyId,
  };
  const endDate = addDays(String(data.startDate), Number(plan.durationDays) - 1);
  const existing = await model
    .findOne({ ...filter, startDate: { $lte: endDate }, endDate: { $gte: data.startDate } })
    .session(session);
  ensure(
    !existing,
    409,
    'OVERLAPPING_SUBSCRIPTION',
    'Subscription overlaps an existing membership',
  );
  const [sub] = await model.create(
    [
      {
        ...data,
        ...(platform ? {} : { tenantId: user.tenantId }),
        endDate,
        pricePaise: plan.pricePaise,
        planName: plan.name,
        ...(platform ? {} : { meal: plan.meal, diet: plan.diet }),
      },
    ],
    { session },
  );
  const tenantId = platform ? partyId : user.tenantId;
  const acct = await account(tenantId, partyId, platform ? 'saas' : 'mess', session);
  const used = Math.min(Number(acct?.balancePaise ?? 0), Number(plan.pricePaise));
  const invoiceModel: Model<DatabaseRecord> =
    resources[platform ? 'saas-invoices' : 'mess-invoices'];
  await invoiceModel.create(
    [
      {
        ...(platform ? {} : { tenantId }),
        partyId,
        subscriptionId: sub._id,
        serviceStart: data.startDate,
        serviceEnd: endDate,
        planId: data.planId,
        planName: plan.name,
        date: data.startDate,
        totalPaise: plan.pricePaise,
        paidPaise: used,
        description: `${plan.name}: ${data.startDate} – ${endDate}`,
      },
    ],
    { session },
  );
  await CustomerCreditLedger.updateOne(
    { _id: acct?._id },
    { $inc: { balancePaise: -used } },
    { session },
  );
  return sub.toObject();
}
async function makePayment(
  user: SessionUser,
  resource: Resource,
  data: Data,
  key: string,
  session: ClientSession,
) {
  const platform = resource === 'saas-payments',
    vendor = resource === 'vendor-payments';
  const partyId = data[platform ? 'hotelId' : vendor ? 'vendorId' : 'customerId'];
  await ref(user, platform ? 'hotels' : vendor ? 'vendors' : 'customers', partyId, session);
  const tenantId = platform ? partyId : user.tenantId;
  const acct = await account(
    tenantId,
    partyId,
    platform ? 'saas' : vendor ? 'vendor' : 'mess',
    session,
  );
  const invoiceResource: Resource = platform
    ? 'saas-invoices'
    : vendor
      ? 'purchases'
      : 'mess-invoices';
  const filter = {
    ...repository(user, invoiceResource).filter,
    [vendor ? 'vendorId' : 'partyId']: partyId,
  };
  const allocations = await applyCredit(
    resources[invoiceResource],
    filter,
    Number(data.amountPaise),
    session,
  );
  await CustomerCreditLedger.updateOne(
    { _id: acct?._id },
    { $inc: { balancePaise: allocations.creditPaise } },
    { session },
  );
  const rest: Data = { ...data };
  delete rest.customerId;
  delete rest.vendorId;
  delete rest.hotelId;
  const [payment] = await (resources[resource] as Model<DatabaseRecord>).create(
    [
      {
        ...rest,
        ...(platform ? {} : { tenantId }),
        partyId,
        idempotencyKey: key,
        requestHash: hash(JSON.stringify(data)),
        ...allocations,
        receiptNo: `R-${new mongoose.Types.ObjectId().toString().toUpperCase()}`,
      },
    ],
    { session },
  );
  return payment.toObject();
}
export async function createRecord(
  user: SessionUser,
  resource: Resource,
  input: unknown,
  key?: string,
  enroll = false,
) {
  ensure(!enroll || resource === 'customers', 400, 'INVALID_RESOURCE', 'Customers required');
  const schema = enroll ? customerEnrollmentSchema : schemas[resource as keyof typeof schemas];
  ensure(schema, 405, 'READ_ONLY', 'This resource is read-only');
  const data = schema.parse(input) as Data;
  const repo = repository(user, resource);
  const requiresKey = enroll || immutable.has(resource) || resource === 'hotels';
  ensure(
    !requiresKey || (key && key.length >= 16 && key.length <= 128),
    400,
    'IDEMPOTENCY_REQUIRED',
    'A unique Idempotency-Key header is required',
  );
  let result: unknown;
  await mongoose.connection
    .transaction(async (session) => {
      if (key) {
        const existing = await Idempotency.findOne({
          tenantId: user.tenantId ?? user.id,
          key,
          resource,
        })
          .session(session)
          .lean();
        if (existing) {
          ensure(
            existing.requestHash === hash(JSON.stringify(data)),
            409,
            'IDEMPOTENCY_CONFLICT',
            'Key was already used with a different request',
          );
          result = existing.response;
          return;
        }
      }
      if (enroll) {
        const { planId, startDate, ...customer } = data;
        const [record] = await repo.model.create([{ ...customer, tenantId: user.tenantId }], {
          session,
        });
        const subscription = await makeSubscription(
          user,
          'subscriptions',
          {
            planId,
            startDate,
            customerId: String(record._id),
          },
          session,
        );
        await audit(
          user,
          'create',
          'subscriptions',
          String(subscription._id),
          { enrollment: true },
          session,
        );
        result = record.toObject();
      } else if (resource === 'hotels') {
        const ownerId = new mongoose.Types.ObjectId(),
          tenantId = new mongoose.Types.ObjectId();
        const { ownerName, ownerEmail, ownerPassword, ...hotel } = data;
        await User.create(
          [
            {
              _id: ownerId,
              tenantId,
              name: ownerName,
              email: String(ownerEmail).toLowerCase(),
              passwordHash: await bcrypt.hash(String(ownerPassword), 12),
              role: 'hotel_owner',
            },
          ],
          { session },
        );
        const [record] = await Tenant.create([{ ...hotel, _id: tenantId, ownerId }], { session });
        await HotelSettings.create(
          [
            {
              tenantId,
              name: hotel.name,
              address: hotel.address,
              phone: hotel.phone,
              email: hotel.email,
              logo: '',
              timezone: 'Asia/Kolkata',
              lunchTime: '12:30',
              dinnerTime: '19:30',
              paymentMethods: ['cash', 'upi'],
            },
          ],
          { session },
        );
        result = record.toObject();
      } else if (resource === 'subscriptions' || resource === 'saas-subscriptions')
        result = await makeSubscription(user, resource, data, session);
      else if (['mess-payments', 'saas-payments', 'vendor-payments'].includes(resource))
        result = await makePayment(user, resource, data, key!, session);
      else if (['mess-refunds', 'vendor-refunds', 'saas-refunds'].includes(resource)) {
        const kind = resource.split('-')[0] as LedgerKind;
        const mapping = ledgerResources[kind];
        const original = await ref(user, mapping.payment, data.paymentId, session);
        const partyId = original.partyId;
        await account(kind === 'saas' ? partyId : user.tenantId, partyId, kind, session);
        const [refunded] = await repo.model
          .aggregate([
            {
              $match: {
                ...repo.filter,
                paymentId: new mongoose.Types.ObjectId(String(data.paymentId)),
              },
            },
            { $group: { _id: null, amount: { $sum: '$amountPaise' } } },
          ])
          .session(session);
        ensure(
          Number(data.amountPaise) + Number(refunded?.amount ?? 0) <= Number(original.amountPaise),
          400,
          'REFUND_EXCEEDS_PAYMENT',
          'Refund exceeds the remaining refundable payment',
        );
        const [record] = await repo.model.create(
          [{ ...data, partyId, ...(kind === 'saas' ? {} : { tenantId: user.tenantId }) }],
          { session },
        );
        await reconcileAccount(user, partyId, kind, session);
        result = record.toObject();
      } else if (resource === 'purchases') {
        await ref(user, 'vendors', data.vendorId, session);
        const acct = await account(user.tenantId, data.vendorId, 'vendor', session);
        const items = data.items as {
          name: string;
          quantity: number;
          ratePaise: number;
          unit: string;
        }[];
        const totalPaise = purchaseTotal(items);
        const used = Math.min(Number(acct?.balancePaise ?? 0), totalPaise);
        const { items: _items, ...rest } = data;
        const [purchase] = await repo.model.create(
          [{ ...rest, tenantId: user.tenantId, totalPaise, paidPaise: used }],
          { session },
        );
        await VendorPurchaseItem.create(
          items.map((i) => ({ ...i, tenantId: user.tenantId, purchaseId: purchase._id })),
          { session },
        );
        await CustomerCreditLedger.updateOne(
          { _id: acct?._id },
          { $inc: { balancePaise: -used } },
          { session },
        );
        result = purchase.toObject();
      } else if (resource === 'adjustments') {
        await account(user.tenantId, data.customerId, 'mess', session);
        const sub = await ref(user, 'subscriptions', data.subscriptionId, session);
        ensure(
          String(sub.customerId) === data.customerId,
          400,
          'INVALID_REFERENCE',
          'Subscription does not belong to this customer',
        );
        if (data.type === 'extension') {
          const endDate = addDays(String(sub.endDate), Number(data.days));
          const overlap = await repo.model.db
            .model('MessSubscription')
            .findOne({
              tenantId: user.tenantId,
              customerId: data.customerId,
              _id: { $ne: data.subscriptionId },
              startDate: { $lte: endDate },
              endDate: { $gte: sub.startDate },
            })
            .session(session);
          ensure(
            !overlap,
            409,
            'OVERLAPPING_SUBSCRIPTION',
            'Extension overlaps another subscription',
          );
          await resources.subscriptions.updateOne(
            { _id: sub._id, tenantId: user.tenantId },
            { $set: { endDate } },
            { session },
          );
        } else {
          await account(user.tenantId, data.customerId, 'mess', session);
          const invoice = await repository(user, 'mess-invoices')
            .find({ subscriptionId: data.subscriptionId })
            .session(session)
            .lean();
          const [previous] = await resources.adjustments
            .aggregate([
              {
                $match: {
                  tenantId: new mongoose.Types.ObjectId(user.tenantId),
                  subscriptionId: new mongoose.Types.ObjectId(String(data.subscriptionId)),
                  type: 'credit',
                },
              },
              { $group: { _id: null, amount: { $sum: '$amountPaise' } } },
            ])
            .session(session);
          ensure(
            Number(previous?.amount ?? 0) + Number(data.amountPaise) <=
              Number(invoice[0]?.totalPaise ?? 0),
            400,
            'EXCESS_CREDIT',
            'Total credit cannot exceed the subscription invoice',
          );
        }
        const [record] = await repo.model.create(
          [{ ...data, tenantId: user.tenantId, date: await localToday(user) }],
          { session },
        );
        if (data.type === 'credit') await reconcileAccount(user, data.customerId, 'mess', session);
        result = record.toObject();
      } else {
        await validateReferences(user, resource, data, session);
        const [record] = await repo.model.create(
          [{ ...data, ...(isPlatform(resource) ? {} : { tenantId: user.tenantId }) }],
          { session },
        );
        result = record.toObject();
      }
      await audit(
        user,
        'create',
        resource,
        String((result as Data)._id),
        { fields: Object.keys(data).filter((k) => !k.toLowerCase().includes('password')) },
        session,
      );
      if (key)
        await Idempotency.create(
          [
            {
              tenantId: user.tenantId ?? user.id,
              key,
              resource,
              requestHash: hash(JSON.stringify(data)),
              response: result,
            },
          ],
          { session },
        );
    })
    .catch(async (error: unknown) => {
      if (
        key &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        const committed = await Idempotency.findOne({
          tenantId: user.tenantId ?? user.id,
          key,
          resource,
        }).lean();
        if (committed) {
          ensure(
            committed.requestHash === hash(JSON.stringify(data)),
            409,
            'IDEMPOTENCY_CONFLICT',
            'Key was already used with a different request',
          );
          result = committed.response;
          return;
        }
      }
      throw error;
    });
  return result;
}
async function validateReferences(
  user: SessionUser,
  resource: Resource,
  data: Data,
  session: ClientSession,
) {
  if (['attendance', 'leaves'].includes(resource))
    await account(user.tenantId, data.customerId, 'mess', session);
  if (data.customerId) {
    const customer = await ref(user, 'customers', data.customerId, session);
    ensure(customer.status === 'active', 400, 'INACTIVE', 'Customer is inactive');
  }
  if (data.categoryId)
    await ref(
      user,
      resource === 'vendors' ? 'vendor-categories' : 'expense-categories',
      data.categoryId,
      session,
    );
  if (resource === 'attendance') {
    const member = await repository(user, 'subscriptions')
      .find({
        customerId: data.customerId,
        startDate: { $lte: data.date },
        endDate: { $gte: data.date },
        meal: { $in: [data.meal, 'both'] },
      })
      .session(session)
      .lean();
    ensure(member.length, 400, 'NO_MEMBERSHIP', 'Customer has no valid subscription for this meal');
    const leave = await repository(user, 'leaves')
      .find({
        customerId: data.customerId,
        status: 'active',
        startDate: { $lte: data.date },
        endDate: { $gte: data.date },
        meal: { $in: [data.meal, 'both'] },
      })
      .session(session)
      .lean();
    ensure(
      data.status === 'absent' || !leave.length,
      409,
      'ON_LEAVE',
      'Customer is on leave for this meal',
    );
  }
  if (resource === 'leaves') {
    const present = await repository(user, 'attendance')
      .find({
        customerId: data.customerId,
        status: 'present',
        date: { $gte: data.startDate, $lte: data.endDate },
        ...(data.meal === 'both' ? {} : { meal: data.meal }),
      })
      .session(session)
      .lean();
    ensure(
      !present.length,
      409,
      'ATTENDANCE_CONFLICT',
      'Correct present attendance before recording leave for these meals',
    );
    const membership = await repository(user, 'subscriptions')
      .find({
        customerId: data.customerId,
        startDate: { $lte: data.startDate },
        endDate: { $gte: data.endDate },
        meal: { $in: data.meal === 'both' ? ['both'] : [data.meal, 'both'] },
      })
      .session(session)
      .lean();
    ensure(
      membership.length,
      400,
      'NO_MEMBERSHIP',
      'Leave must fall within a subscription covering the selected meals',
    );
    const overlap = await repository(user, 'leaves')
      .find({
        customerId: data.customerId,
        status: 'active',
        startDate: { $lte: data.endDate },
        endDate: { $gte: data.startDate },
        ...(data.meal === 'both' ? {} : { meal: { $in: [data.meal, 'both'] } }),
      })
      .session(session)
      .lean();
    ensure(!overlap.length, 409, 'OVERLAPPING_LEAVE', 'Leave overlaps an existing record');
  }
}
export async function updateRecord(
  user: SessionUser,
  resource: Resource,
  id: string,
  input: unknown,
) {
  if (isCorrectable(resource)) return correctRecord(user, resource, id, input);
  ensure(
    !immutable.has(resource),
    405,
    'IMMUTABLE_RECORD',
    'Financial and subscription records cannot be edited; record an adjustment',
  );
  const repo = repository(user, resource);
  let data: Data;
  if (resource === 'hotels') {
    const { z } = await import('zod');
    data = z
      .object({
        name: z.string().min(1).max(200).optional(),
        phone: z.string().max(20).optional(),
        email: z.string().email().or(z.literal('')).optional(),
        address: z.string().max(2000).optional(),
        status: z.enum(['active', 'inactive', 'suspended']).optional(),
        graceDays: z.number().int().min(0).max(30).optional(),
      })
      .strict()
      .parse(input);
  } else if (resource === 'leaves') {
    const { z } = await import('zod');
    data = z
      .object({ status: z.literal('cancelled') })
      .strict()
      .parse(input);
  } else {
    const schema = schemas[resource as keyof typeof schemas];
    ensure(schema, 405, 'READ_ONLY', 'Read-only resource');
    data = schema.parse(input) as Data;
  }
  let updated: unknown;
  await mongoose.connection.transaction(async (session) => {
    if (resource === 'customers') await account(user.tenantId, id, 'mess', session);
    const old = await repo.one(id).session(session).lean();
    ensure(old, 404, 'NOT_FOUND', 'Record not found');
    if (resource !== 'hotels' && resource !== 'leaves')
      await validateReferences(user, resource, data, session);
    updated = await repo.model
      .findOneAndUpdate(
        { ...repo.filter, _id: id },
        { $set: data },
        { new: true, runValidators: true, session },
      )
      .lean();
    await audit(user, 'update', resource, id, { before: old, changes: data }, session);
  });
  return updated;
}
export async function localToday(user: SessionUser) {
  const settings = user.tenantId
    ? await HotelSettings.findOne({ tenantId: user.tenantId }).lean()
    : null;
  return businessDate(String(settings?.timezone ?? 'Asia/Kolkata'));
}
