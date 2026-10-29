import { Router } from 'express';
import { z } from 'zod';
import { id, settingsSchema } from '@annapurna/validation';
import { ROLES } from '@annapurna/constants';
import {
  resources,
  type Resource,
  HotelSettings,
  PlatformSettings,
  VendorPurchaseItem,
  User,
} from '../../core/database/models.js';
import { repository } from '../../core/tenancy/repository.js';
import { ensure } from '../../core/errors/index.js';
import { asyncRoute } from '../../shared/helpers/http.js';
import { createRecord, updateRecord, audit } from './service.js';
import { enrichRecords } from './presentation.js';
import { dashboard } from '../reports/service.js';
import { attendanceRoster } from './attendance.js';
export const operationsRouter = Router();
operationsRouter.get(
  '/mess/attendance-roster',
  asyncRoute(async (req, res) => {
    res.json({ success: true, data: await attendanceRoster(req.user, req.query) });
  }),
);
operationsRouter.post(
  '/customers/enroll',
  asyncRoute(async (req, res) => {
    const data = await createRecord(
      req.user,
      'customers',
      req.body,
      req.get('Idempotency-Key'),
      true,
    );
    res.status(201).json({ success: true, data });
  }),
);
operationsRouter.get(
  '/subscription-status',
  asyncRoute(async (req, res) => {
    ensure(req.user.role === ROLES.owner, 403, 'FORBIDDEN', 'Hotel owner required');
    const { TenantSubscription, Tenant } = await import('../../core/database/models.js');
    const subscription = await TenantSubscription.findOne({ hotelId: req.user.tenantId })
      .sort({ endDate: -1 })
      .lean();
    const hotel = await Tenant.findById(req.user.tenantId).lean();
    res.json({ success: true, data: { subscription, graceDays: hotel?.graceDays ?? 0 } });
  }),
);
operationsRouter.get(
  '/dashboard',
  asyncRoute(async (req, res) => {
    res.json({ success: true, data: await dashboard(req.user) });
  }),
);
operationsRouter.get(
  '/settings',
  asyncRoute(async (req, res) => {
    const data =
      req.user.role === ROLES.admin
        ? await PlatformSettings.findOne({ key: 'platform' }).lean()
        : await HotelSettings.findOne({ tenantId: req.user.tenantId }).lean();
    res.json({ success: true, data: data ?? {} });
  }),
);
operationsRouter.put(
  '/settings',
  asyncRoute(async (req, res) => {
    let data;
    if (req.user.role === ROLES.admin) {
      const parsed = z
        .object({ name: z.string().min(1).max(200), supportEmail: z.string().email() })
        .strict()
        .parse(req.body);
      data = await PlatformSettings.findOneAndUpdate(
        { key: 'platform' },
        { $set: parsed },
        { upsert: true, new: true, runValidators: true },
      );
    } else {
      data = await HotelSettings.findOneAndUpdate(
        { tenantId: req.user.tenantId },
        { $set: settingsSchema.parse(req.body) },
        { upsert: true, new: true, runValidators: true },
      );
    }
    await audit(req.user, 'update', 'settings', String(data?._id), {});
    res.json({ success: true, data });
  }),
);
operationsRouter.get(
  '/audit',
  asyncRoute(async (req, res) => {
    const { AuditLog } = await import('../../core/database/models.js');
    const logs = await AuditLog.find(
      req.user.role === ROLES.admin ? {} : { tenantId: req.user.tenantId },
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: logs });
  }),
);
const resource = (name: string) => {
  ensure(Object.hasOwn(resources, name), 404, 'NOT_FOUND', 'Resource not found');
  return name as Resource;
};
operationsRouter.get(
  '/:resource',
  asyncRoute(async (req, res) => {
    const name = resource(req.params.resource),
      repo = repository(req.user, name);
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        q: z.string().max(100).default(''),
        sort: z
          .enum(['createdAt', 'name', 'date', 'startDate', 'endDate', 'amountPaise'])
          .default('createdAt'),
        order: z.enum(['asc', 'desc']).default('desc'),
        status: z.string().max(30).optional(),
        customerId: id.optional(),
        vendorId: id.optional(),
        partyId: id.optional(),
        hotelId: id.optional(),
        subscriptionId: id.optional(),
      })
      .parse(req.query);
    const filter: Record<string, unknown> = { ...repo.filter };
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        'name',
        'customerCode',
        'phone',
        'email',
        'note',
        'description',
        'planName',
        'receiptNo',
      ].map((k) => ({ [k]: { $regex: escaped, $options: 'i' } }));
    }
    if (query.status) filter.status = query.status;
    for (const k of ['customerId', 'vendorId', 'partyId', 'hotelId', 'subscriptionId'] as const)
      if (query[k]) filter[k] = query[k];
    const [items, total] = await Promise.all([
      repo.model
        .find(filter)
        .sort({ [query.sort]: query.order === 'asc' ? 1 : -1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      repo.model.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        items: await enrichRecords(req.user, name, items),
        total,
        page: query.page,
        limit: query.limit,
      },
    });
  }),
);
operationsRouter.get(
  '/:resource/:id',
  asyncRoute(async (req, res) => {
    const name = resource(req.params.resource);
    const repo = repository(req.user, name);
    const { voidedAt: _voidedAt, ...historyFilter } = repo.filter;
    const record = await repo.model
      .findOne({ ...historyFilter, _id: id.parse(req.params.id) })
      .lean();
    ensure(record, 404, 'NOT_FOUND', 'Record not found');
    const [presented] = await enrichRecords(req.user, name, [record]);
    let related: unknown;
    if (name === 'purchases')
      related = await VendorPurchaseItem.find({
        tenantId: req.user.tenantId,
        purchaseId: req.params.id,
      })
        .select('name quantity unit ratePaise -_id')
        .lean();
    if (name === 'hotels')
      related = await User.findOne({ _id: (record as Record<string, unknown>).ownerId })
        .select('name email status')
        .lean();
    res.json({
      success: true,
      data: {
        ...presented,
        ...(related ? { [name === 'purchases' ? 'items' : 'related']: related } : {}),
      },
    });
  }),
);
operationsRouter.post(
  '/:resource',
  asyncRoute(async (req, res) => {
    const data = await createRecord(
      req.user,
      resource(req.params.resource),
      req.body,
      req.get('Idempotency-Key'),
    );
    res.status(201).json({ success: true, data });
  }),
);
operationsRouter.put(
  '/:resource/:id',
  asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: await updateRecord(
        req.user,
        resource(req.params.resource),
        id.parse(req.params.id),
        req.body,
      ),
    });
  }),
);
