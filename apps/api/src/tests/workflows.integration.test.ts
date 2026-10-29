import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Express } from 'express';
import type { SessionUser } from '@annapurna/types';
import type { Resource } from '../core/database/models.js';
let replica: MongoMemoryReplSet, app: Express, tokenA: string, tokenB: string, _adminToken: string;
let userA: SessionUser,
  userB: SessionUser,
  customer: string,
  plan: string,
  subscription: string,
  vendor: string;
const origin = 'http://localhost:5173';
const pass = 'IntegrationPass123!';
const post = (path: string, token: string, body: object, key = crypto.randomUUID()) =>
  request(app)
    .post(`/api/v1/${path}`)
    .set('Origin', origin)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send(body);
let models: typeof import('../core/database/models.js');
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'integration-secret-long-enough-for-48-characters-123456';
  process.env.WEB_ORIGIN = origin;
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: '7.0.14' },
  });
  process.env.MONGODB_URI = replica.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
  models = await import('../core/database/models.js');
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  app = (await import('../app.js')).createApp();
  const admin = await models.User.create({
    name: 'Admin',
    email: 'admin@test.in',
    role: 'super_admin',
    passwordHash: await bcrypt.hash(pass, 4),
  });
  _adminToken = (
    await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: admin.email, password: pass })
  ).body.data.accessToken;
  const { createRecord } = await import('../modules/operations/service.js');
  const adminUser = {
    id: String(admin._id),
    name: 'Admin',
    email: String(admin.email),
    role: 'super_admin' as const,
  };
  const saas = (await createRecord(adminUser, 'saas-plans', {
    name: 'Monthly',
    pricePaise: 10000,
    durationDays: 30,
    billingCycle: 'monthly',
    status: 'active',
  })) as { _id: unknown };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  for (const [i, email] of ['a@test.in', 'b@test.in'].entries()) {
    const hotel = (await createRecord(
      adminUser,
      'hotels',
      {
        name: `Hotel ${i}`,
        phone: '9876543210',
        ownerName: `Owner ${i}`,
        ownerEmail: email,
        ownerPassword: pass,
      },
      crypto.randomUUID(),
    )) as { _id: unknown };
    await createRecord(
      adminUser,
      'saas-subscriptions',
      { hotelId: String(hotel._id), planId: String(saas._id), startDate: today },
      crypto.randomUUID(),
    );
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email, password: pass });
    if (i === 0) {
      tokenA = response.body.data.accessToken;
      userA = response.body.data.user;
    } else {
      tokenB = response.body.data.accessToken;
      userB = response.body.data.user;
    }
  }
});
afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});
describe.sequential('tenant and operational workflows', () => {
  it('requires authentication and validates login', async () => {
    expect((await request(app).get('/api/v1/customers')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Origin', origin)
          .send({ email: 'a@test.in', password: 'wrong' })
      ).status,
    ).toBe(401);
  });
  it('creates customers and disallows tenant injection', async () => {
    const body = { name: 'Asha', phone: '9876543210', customerCode: 'M001' };
    const a = await post('customers', tokenA, body);
    expect(a.status).toBe(201);
    customer = a.body.data._id;
    expect((await post('customers', tokenA, { ...body, tenantId: userB.tenantId })).status).toBe(
      400,
    );
    expect((await post('customers', tokenB, body)).status).toBe(201);
  });
  it('isolates lists, direct reads, references and platform APIs', async () => {
    const list = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0]._id).not.toBe(customer);
    expect(
      (
        await request(app)
          .get(`/api/v1/customers/${customer}`)
          .set('Authorization', `Bearer ${tokenB}`)
      ).status,
    ).toBe(404);
    expect(
      (await request(app).get('/api/v1/hotels').set('Authorization', `Bearer ${tokenA}`)).status,
    ).toBe(403);
  });
  it('assigns a price snapshot and rejects overlapping renewals', async () => {
    const p = await post('mess-plans', tokenA, {
      name: 'Both meals',
      pricePaise: 300000,
      durationDays: 30,
      meal: 'both',
      diet: 'veg',
    });
    plan = p.body.data._id;
    const response = await post('subscriptions', tokenA, {
      planId: plan,
      customerId: customer,
      startDate: '2026-10-01',
    });
    expect(response.status).toBe(201);
    subscription = response.body.data._id;
    expect(response.body.data.endDate).toBe('2026-10-30');
    expect(
      (
        await post('subscriptions', tokenA, {
          planId: plan,
          customerId: customer,
          startDate: '2026-10-15',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await post('subscriptions', tokenB, {
          planId: plan,
          customerId: customer,
          startDate: '2026-10-01',
        })
      ).status,
    ).toBe(404);
  });
  it('prevents attendance duplicates and permits audited correction', async () => {
    const body = { customerId: customer, date: '2026-10-29', meal: 'lunch', status: 'present' };
    const response = await post('attendance', tokenA, body);
    expect(response.status).toBe(201);
    expect((await post('attendance', tokenA, body)).status).toBe(409);
    const edit = await request(app)
      .put(`/api/v1/attendance/${response.body.data._id}`)
      .set('Origin', origin)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...body, status: 'absent' });
    expect(edit.status).toBe(200);
  });
  it('records leave and prevents present attendance on leave', async () => {
    expect(
      (
        await post('leaves', tokenA, {
          customerId: customer,
          startDate: '2026-10-30',
          endDate: '2026-10-30',
          meal: 'both',
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await post('attendance', tokenA, {
          customerId: customer,
          date: '2026-10-30',
          meal: 'dinner',
          status: 'present',
        })
      ).status,
    ).toBe(409);
  });
  it('allocates partial payments, makes retries idempotent, preserves advances', async () => {
    const key = crypto.randomUUID(),
      body = { customerId: customer, date: '2026-10-29', method: 'upi', amountPaise: 100001 };
    const first = await post('mess-payments', tokenA, body, key);
    expect(first.status).toBe(201);
    const retry = await post('mess-payments', tokenA, body, key);
    expect(retry.body.data._id).toBe(first.body.data._id);
    expect((await post('mess-payments', tokenA, { ...body, amountPaise: 1 }, key)).status).toBe(
      409,
    );
    const invoice = await models.MessInvoice.findOne({
      tenantId: userA.tenantId,
      partyId: customer,
    }).lean();
    expect(invoice?.paidPaise).toBe(100001);
    const advance = await post('mess-payments', tokenA, { ...body, amountPaise: 250000 });
    expect(advance.body.data.creditPaise).toBe(50001);
  });
  it('consumes advance on renewal and audits credits/extensions', async () => {
    const renewal = await post('subscriptions', tokenA, {
      customerId: customer,
      planId: plan,
      startDate: '2026-10-31',
    });
    expect(renewal.status).toBe(201);
    const invoice = await models.MessInvoice.findOne({
      subscriptionId: renewal.body.data._id,
    }).lean();
    expect(invoice?.paidPaise).toBe(50001);
    const adjustment = await post('adjustments', tokenA, {
      customerId: customer,
      subscriptionId: subscription,
      type: 'credit',
      amountPaise: 10000,
      days: 0,
      note: 'Approved meal credit',
    });
    expect(adjustment.status).toBe(201);
    expect(
      await models.AuditLog.countDocuments({ tenantId: userA.tenantId, resource: 'adjustments' }),
    ).toBe(1);
  });
  it('calculates vendor dues and avoids double-counting purchases', async () => {
    vendor = (await post('vendors', tokenA, { name: 'Fresh Farms', phone: '9876543210' })).body.data
      ._id;
    expect(
      (
        await post('purchases', tokenA, {
          vendorId: vendor,
          date: '2026-10-29',
          items: [{ name: 'Rice', quantity: 5, unit: 'kg', ratePaise: 6000 }],
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await post('vendor-payments', tokenA, {
          vendorId: vendor,
          date: '2026-10-29',
          method: 'cash',
          amountPaise: 10000,
        })
      ).status,
    ).toBe(201);
    const { financialSummary } = await import('../modules/reports/service.js');
    const summary = await financialSummary(userA, '2026-10-01', '2026-10-31');
    expect(summary.vendorOutstandingPaise).toBe(20000);
    expect(summary.purchasesIncurredPaise).toBe(30000);
    expect(summary.expensesIncurredAndPaidPaise).toBe(0);
    expect(summary.vendorPaymentsPaise).toBe(10000);
  });
  it('reconciles sales and filtered reports/exports', async () => {
    expect(
      (
        await post('sales', tokenA, {
          date: '2026-10-29',
          dineInPaise: 10000,
          parcelPaise: 5000,
          otherPaise: 0,
          cashPaise: 12000,
          upiPaise: 3000,
        })
      ).status,
    ).toBe(201);
    const path = '/api/v1/reports/mess-collection';
    const filters = 'preset=custom&from=2026-10-29&to=2026-10-29&method=upi';
    const result = await request(app)
      .get(`${path}?${filters}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(result.status).toBe(200);
    expect(result.body.data.totals.amountPaise).toBe(350001);
    const csv = await request(app)
      .get(`${path}/export/csv?${filters}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('350001');
    expect(csv.text).not.toContain(userB.tenantId);
  });
  it('rotates refresh tokens and rejects reuse', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: 'a@test.in', password: pass });
    const cookie = String(login.headers['set-cookie'][0]).split(';')[0];
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', cookie);
    expect(refresh.status).toBe(200);
    expect(
      (await request(app).post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', cookie))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', String(refresh.headers['set-cookie'][0]).split(';')[0])
          .set('Origin', origin)
      ).status,
    ).toBe(401);
  });
  it('combines vendor ledger flows with running balances and scoped exports', async () => {
    const { report } = await import('../modules/reports/service.js');
    const ledger = await report(userA, 'vendor-ledger', {
      preset: 'custom',
      from: '2026-10-01',
      to: '2026-10-31',
      vendorId: vendor,
    });
    expect(ledger.total).toBe(2);
    expect(ledger.totals.debitPaise).toBe(30000);
    expect(ledger.totals.creditPaise).toBe(10000);
    expect(
      ledger.items.find((r: Record<string, unknown>) => r.source === 'payment').balancePaise,
    ).toBe(20000);
    for (const format of ['xlsx', 'pdf']) {
      const result = await request(app)
        .get(
          `/api/v1/reports/vendor-ledger/export/${format}?preset=custom&from=2026-10-01&to=2026-10-31&vendorId=${vendor}`,
        )
        .set('Authorization', `Bearer ${tokenA}`);
      expect(result.status).toBe(200);
      expect(result.headers['content-disposition']).toContain(`.${format}`);
    }
  });
  it('reconciles combined income, cost and cash collection rows', async () => {
    const { report } = await import('../modules/reports/service.js');
    const filters = { preset: 'custom', from: '2026-10-01', to: '2026-10-31' };
    const income = await report(userA, 'income', filters);
    const credit = await models.MessAdjustment.findOne({
      tenantId: userA.tenantId,
      type: 'credit',
    }).lean();
    const creditInRange =
      String(credit?.date) >= '2026-10-01' && String(credit?.date) <= '2026-10-31';
    expect(income.totals.incomePaise).toBe(325000 - (creditInRange ? 10000 : 0));
    const profit = await report(userA, 'profit-loss', filters);
    expect(profit.totals.netPaise).toBe(295000 - (creditInRange ? 10000 : 0));
    const cash = await report(userA, 'cash-upi', filters);
    expect(cash.totals.cashPaise).toBe(12000);
    expect(cash.totals.upiPaise).toBe(353001);
  });
  it('replays concurrent idempotent payment requests without duplicate collection', async () => {
    const key = crypto.randomUUID();
    const body = { customerId: customer, date: '2026-10-29', amountPaise: 101, method: 'cash' };
    const [a, b] = await Promise.all([
      post('mess-payments', tokenA, body, key),
      post('mess-payments', tokenA, body, key),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data._id).toBe(b.body.data._id);
    expect(
      await models.MessPayment.countDocuments({ tenantId: userA.tenantId, idempotencyKey: key }),
    ).toBe(1);
  });
  it('enrolls customers atomically, retries safely and rolls back invalid plans', async () => {
    const body = {
      name: 'Enrolled customer',
      phone: '9876543210',
      customerCode: 'ENROLL-01',
      planId: plan,
      startDate: '2027-01-20',
    };
    const key = crypto.randomUUID();
    const response = await post('customers/enroll', tokenA, body, key);
    expect(response.status).toBe(201);
    const id = response.body.data._id;
    expect((await post('customers/enroll', tokenA, body, key)).body.data._id).toBe(id);
    expect(await models.MessSubscription.countDocuments({ customerId: id })).toBe(1);
    expect(await models.MessInvoice.countDocuments({ partyId: id })).toBe(1);
    expect(
      (await post('customers/enroll', tokenA, { ...body, name: 'Different' }, key)).status,
    ).toBe(409);
    expect(
      (await post('customers/enroll', tokenA, { ...body, tenantId: userB.tenantId })).status,
    ).toBe(400);
    expect((await post('customers/enroll', tokenB, body)).status).toBe(404);
    expect(
      await models.MessCustomer.countDocuments({
        tenantId: userB.tenantId,
        customerCode: 'ENROLL-01',
      }),
    ).toBe(0);
    const before = await models.MessCustomer.countDocuments({ tenantId: userA.tenantId });
    expect(
      (
        await post('customers/enroll', tokenA, {
          ...body,
          customerCode: 'ROLLBACK',
          planId: new mongoose.Types.ObjectId().toString(),
        })
      ).status,
    ).toBe(404);
    expect(await models.MessCustomer.countDocuments({ tenantId: userA.tenantId })).toBe(before);
    expect(
      (
        await post('leaves', tokenA, {
          customerId: id,
          startDate: '2027-01-30',
          endDate: '2027-02-02',
          meal: 'both',
        })
      ).status,
    ).toBe(201);
    const roster = (token: string, date: string, meal = 'lunch') =>
      request(app)
        .get('/api/v1/mess/attendance-roster')
        .query({ date, meal, customerId: id })
        .set('Authorization', `Bearer ${token}`);
    const january = await roster(tokenA, '2027-01-30');
    expect(january.status).toBe(200);
    expect(january.body.data.items[0]).toMatchObject({
      status: 'leave',
      leaveDays: 2,
      leaveMeals: 4,
    });
    expect((await roster(tokenA, '2027-02-01', 'dinner')).body.data.items[0]).toMatchObject({
      status: 'leave',
      leaveDays: 2,
      leaveMeals: 4,
    });
    const lunchLeave = await post('leaves', tokenA, {
      customerId: id,
      startDate: '2027-01-22',
      endDate: '2027-01-23',
      meal: 'lunch',
    });
    expect(lunchLeave.status).toBe(201);
    expect(
      (
        await post('leaves', tokenA, {
          customerId: id,
          startDate: '2027-01-23',
          endDate: '2027-01-23',
          meal: 'dinner',
        })
      ).status,
    ).toBe(201);
    expect((await roster(tokenA, '2027-01-23')).body.data.items[0]).toMatchObject({
      leaveDays: 4,
      leaveMeals: 7,
    });
    const cancelled = await request(app)
      .put(`/api/v1/leaves/${lunchLeave.body.data._id}`)
      .set('Origin', origin)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'cancelled' });
    expect(cancelled.status).toBe(200);
    expect((await roster(tokenA, '2027-01-23')).body.data.items[0]).toMatchObject({
      status: 'unmarked',
      leaveDays: 3,
      leaveMeals: 5,
    });
    expect((await roster(tokenB, '2027-01-30')).body.data.items).toHaveLength(0);
    expect((await roster(tokenA, '2027-02-30')).status).toBe(400);
    const mark = await post('attendance', tokenA, {
      customerId: id,
      date: '2027-01-21',
      meal: 'lunch',
      status: 'present',
    });
    expect(mark.status).toBe(201);
    expect((await roster(tokenA, '2027-01-21')).body.data.items[0]).toMatchObject({
      status: 'present',
      attendanceId: mark.body.data._id,
    });
    expect(
      (
        await post('attendance', tokenA, {
          customerId: id,
          date: '2027-01-30',
          meal: 'lunch',
          status: 'present',
        })
      ).status,
    ).toBe(409);
  });
  it('enforces subscription expiry and suspension on previously issued tokens', async () => {
    await models.TenantSubscription.updateMany(
      { hotelId: userB.tenantId },
      { $set: { endDate: '2000-01-01' } },
    );
    expect(
      (await request(app).get('/api/v1/customers').set('Authorization', `Bearer ${tokenB}`)).status,
    ).toBe(402);
    expect(
      (await request(app).get('/api/v1/settings').set('Authorization', `Bearer ${tokenB}`)).status,
    ).toBe(200);
    await models.Tenant.updateOne({ _id: userB.tenantId }, { $set: { status: 'suspended' } });
    expect(
      (await request(app).get('/api/v1/settings').set('Authorization', `Bearer ${tokenB}`)).status,
    ).toBe(403);
  });
  it('checks cookie CSRF origin', async () =>
    expect(
      (await request(app).post('/api/v1/auth/logout').set('Origin', 'https://evil.test')).status,
    ).toBe(403));
  it('invalidates access immediately when a session logs out', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: 'a@test.in', password: pass });
    const token = response.body.data.accessToken;
    const cookie = String(response.headers['set-cookie'][0]).split(';')[0];
    expect(
      (await request(app).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', cookie))
        .status,
    ).toBe(200);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(401);
  });
  it('groups platform revenue by plan with exact filtered exports', async () => {
    const result = await request(app)
      .get('/api/v1/reports/saas-revenue?preset=this-month&groupBy=plan')
      .set('Authorization', `Bearer ${_adminToken}`);
    expect(result.status).toBe(200);
    expect(result.body.data.items).toHaveLength(1);
    expect(result.body.data.items[0].planName).toBe('Monthly');
    expect(result.body.data.items[0].billedPaise).toBe(20000);
  });
  it('records refunds without changing original receipts and reconciles dues', async () => {
    const payment = await models.MessPayment.findOne({
      tenantId: userA.tenantId,
      amountPaise: 100001,
    }).lean();
    const { financialSummary } = await import('../modules/reports/service.js');
    const before = await financialSummary(userA, '2026-10-01', '2026-10-31');
    const key = crypto.randomUUID(),
      body = {
        paymentId: String(payment?._id),
        amountPaise: 50000,
        date: '2026-10-29',
        method: 'upi',
        note: 'Approved partial refund',
      };
    const response = await post('mess-refunds', tokenA, body, key);
    expect(response.status).toBe(201);
    expect((await post('mess-refunds', tokenA, body, key)).body.data._id).toBe(
      response.body.data._id,
    );
    expect((await post('mess-refunds', tokenA, { ...body, amountPaise: 50002 })).status).toBe(400);
    expect((await models.MessPayment.findById(payment?._id).lean())?.amountPaise).toBe(100001);
    const after = await financialSummary(userA, '2026-10-01', '2026-10-31');
    expect(after.customerOutstandingPaise).toBe(Number(before.customerOutstandingPaise) + 50000);
    expect(after.messCollectionsPaise).toBe(Number(before.messCollectionsPaise) - 50000);
    const vendorPayment = await models.VendorPayment.findOne({ tenantId: userA.tenantId }).lean();
    expect(
      (
        await post('vendor-refunds', tokenA, {
          paymentId: String(vendorPayment?._id),
          amountPaise: 5000,
          date: '2026-10-29',
          method: 'cash',
          note: 'Vendor returned advance',
        })
      ).status,
    ).toBe(201);
    expect((await financialSummary(userA, '2026-10-01', '2026-10-31')).vendorOutstandingPaise).toBe(
      25000,
    );
  });
  it('preserves original expense and purchase records when corrections replace them', async () => {
    const category = (await post('expense-categories', tokenA, { name: 'Utilities' })).body.data
      ._id;
    const original = await post('expenses', tokenA, {
      date: '2026-10-29',
      categoryId: category,
      description: 'Electricity',
      amountPaise: 10000,
      method: 'cash',
    });
    const edit = {
      date: '2026-10-29',
      categoryId: category,
      description: 'Electricity',
      amountPaise: 25000,
      method: 'cash',
      note: 'Corrected meter bill',
    };
    const corrected = await request(app)
      .put(`/api/v1/expenses/${original.body.data._id}`)
      .set('Origin', origin)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(edit);
    expect(corrected.status).toBe(200);
    expect(corrected.body.data._id).not.toBe(original.body.data._id);
    const historical = await models.Expense.findById(original.body.data._id).lean();
    expect(historical?.amountPaise).toBe(10000);
    expect(historical?.voidedAt).toBeTruthy();
    const { report, financialSummary } = await import('../modules/reports/service.js');
    expect(
      (await report(userA, 'expenses', { preset: 'custom', from: '2026-10-01', to: '2026-10-31' }))
        .totals.amountPaise,
    ).toBe(25000);
    const purchase = await models.VendorPurchase.findOne({
      tenantId: userA.tenantId,
      voidedAt: null,
    }).lean();
    const before = await financialSummary(userA, '2026-10-01', '2026-10-31');
    const replacement = await request(app)
      .put(`/api/v1/purchases/${purchase?._id}`)
      .set('Origin', origin)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        vendorId: vendor,
        date: '2026-10-29',
        items: [{ name: 'Rice', quantity: 5, unit: 'kg', ratePaise: 7000 }],
        note: 'Corrected supplier rate',
      });
    expect(replacement.status).toBe(200);
    expect((await financialSummary(userA, '2026-10-01', '2026-10-31')).vendorOutstandingPaise).toBe(
      Number(before.vendorOutstandingPaise) + 5000,
    );
    expect(await models.resources.corrections.countDocuments({ tenantId: userA.tenantId })).toBe(2);
  });
  it('recognises service revenue across years and retains rounding paise', async () => {
    const customer = (
      await post('customers', tokenA, {
        name: 'Year boundary',
        phone: '9876543210',
        customerCode: 'Y001',
      })
    ).body.data._id;
    const plan = (
      await post('mess-plans', tokenA, {
        name: 'Three days',
        pricePaise: 100,
        durationDays: 3,
        meal: 'lunch',
        diet: 'veg',
      })
    ).body.data._id;
    expect(
      (
        await post('subscriptions', tokenA, {
          customerId: customer,
          planId: plan,
          startDate: '2026-12-30',
        })
      ).status,
    ).toBe(201);
    const { financialSummary } = await import('../modules/reports/service.js');
    expect(
      (await financialSummary(userA, '2026-12-30', '2026-12-31', { customerId: customer }))
        .earnedMessPaise,
    ).toBe(66);
    expect(
      (await financialSummary(userA, '2027-01-01', '2027-01-01', { customerId: customer }))
        .earnedMessPaise,
    ).toBe(34);
  });
  it('isolates every hotel-owned resource through the repository', async () => {
    const { HOTEL_RESOURCES } = await import('@annapurna/constants');
    const { repository } = await import('../core/tenancy/repository.js');
    for (const resource of HOTEL_RESOURCES) {
      const repo = repository(userA, resource as Resource);
      expect(String(repo.filter.tenantId)).toBe(userA.tenantId);
    }
  });
  it('supports one-use password resets and revokes prior sessions', async () => {
    const account = await models.User.create({
      name: 'Password Test',
      email: 'password@test.in',
      role: 'super_admin',
      passwordHash: await bcrypt.hash(pass, 4),
    });
    const logged = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: account.email, password: pass });
    expect(logged.status).toBe(200);
    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', origin)
      .send({ email: account.email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.data).toBeNull();
    const { hash } = await import('../modules/auth/service.js');
    const token = crypto.randomUUID();
    await models.User.updateOne(
      { _id: account._id },
      { $set: { resetHash: hash(token), resetExpires: new Date(Date.now() + 60000) } },
    );
    const body = { token, password: 'NewIntegrationPass123!' };
    expect(
      (await request(app).post('/api/v1/auth/reset-password').set('Origin', origin).send(body))
        .status,
    ).toBe(200);
    expect(
      (await request(app).post('/api/v1/auth/reset-password').set('Origin', origin).send(body))
        .status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${logged.body.data.accessToken}`)
      ).status,
    ).toBe(401);
    const next = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: account.email, password: body.password });
    expect(next.status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/change-password')
          .set('Origin', origin)
          .set('Authorization', `Bearer ${next.body.data.accessToken}`)
          .send({ currentPassword: body.password, password: 'ChangedIntegrationPass123!' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${next.body.data.accessToken}`)
      ).status,
    ).toBe(401);
  });
  it('reconciles the unified customer ledger with invoices, credits and refunds', async () => {
    const { report } = await import('../modules/reports/service.js');
    const ledger = await report(userA, 'customer-ledger', {
      preset: 'custom',
      from: '2000-01-01',
      to: '2099-12-31',
      customerId: customer,
    });
    const invoices = await models.MessInvoice.find({
      tenantId: userA.tenantId,
      partyId: customer,
    }).lean();
    const expected = invoices.reduce(
      (sum, row) =>
        sum + Number(row.totalPaise) - Number(row.paidPaise) - Number(row.creditedPaise),
      0,
    );
    expect(ledger.totals.debitPaise - ledger.totals.creditPaise).toBe(expected);
    expect(ledger.items.some((row: Record<string, unknown>) => row.source === 'refund')).toBe(true);
    expect(
      ledger.items.some((row: Record<string, unknown>) => row.source === 'credit adjustment'),
    ).toBe(true);
  });
  it('audits free extensions while preserving invoice service snapshots and preventing overlap', async () => {
    const base = {
      customerId: customer,
      type: 'extension',
      amountPaise: 0,
      days: 5,
      note: 'Approved leave extension',
    };
    expect(
      (await post('adjustments', tokenA, { ...base, subscriptionId: subscription })).status,
    ).toBe(409);
    const latest = await models.MessSubscription.findOne({
      tenantId: userA.tenantId,
      customerId: customer,
    })
      .sort({ endDate: -1 })
      .lean();
    const invoice = await models.MessInvoice.findOne({ subscriptionId: latest?._id }).lean();
    const extended = await post('adjustments', tokenA, {
      ...base,
      subscriptionId: String(latest?._id),
    });
    expect(extended.status).toBe(201);
    expect((await models.MessSubscription.findById(latest?._id).lean())?.endDate).toBe(
      '2026-12-04',
    );
    expect((await models.MessInvoice.findById(invoice?._id).lean())?.serviceEnd).toBe(
      invoice?.serviceEnd,
    );
  });
});
