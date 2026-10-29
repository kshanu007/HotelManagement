import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.E2E_API_PORT ?? '5000';
process.env.WEB_ORIGIN = `http://localhost:${process.env.E2E_WEB_PORT ?? '5173'}`;
process.env.JWT_SECRET = 'isolated-e2e-only-secret-not-for-production-use-123456';
const replica = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
  binary: { version: '7.0.14' },
});
process.env.MONGODB_URI = replica.getUri();
await mongoose.connect(process.env.MONGODB_URI);
const { User, resources } = await import('../apps/api/src/core/database/models.js');
await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
const admin = await User.create({
  name: 'Test Admin',
  email: 'admin@e2e.test',
  role: 'super_admin',
  passwordHash: await bcrypt.hash('BrowserTestPass123!', 4),
});
const adminUser = {
  id: String(admin._id),
  name: String(admin.name),
  email: String(admin.email),
  role: 'super_admin' as const,
};
const { createRecord } = await import('../apps/api/src/modules/operations/service.js');
const hotel = (await createRecord(
  adminUser,
  'hotels',
  {
    name: 'Test Kitchen',
    phone: '9876543210',
    ownerName: 'Test Owner',
    ownerEmail: 'owner@e2e.test',
    ownerPassword: 'BrowserTestPass123!',
  },
  crypto.randomUUID(),
)) as { _id: unknown };
const plan = await resources['saas-plans'].create({
  name: 'Essential',
  pricePaise: 99900,
  durationDays: 365,
  billingCycle: 'yearly',
  status: 'active',
});
const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
await createRecord(
  adminUser,
  'saas-subscriptions',
  { hotelId: String(hotel._id), planId: String(plan._id), startDate },
  crypto.randomUUID(),
);
const app = (await import('../apps/api/src/app.js')).createApp();
const server = app.listen(Number(process.env.PORT), '127.0.0.1', () =>
  console.log(`Isolated E2E API ready on ${process.env.PORT}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      void mongoose
        .disconnect()
        .then(() => replica.stop())
        .then(() => process.exit());
    });
  });
