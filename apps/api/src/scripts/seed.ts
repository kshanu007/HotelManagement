import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { password } from '@annapurna/validation';
import { connectDatabase } from '../config/database.js';
import { User, resources } from '../core/database/models.js';
import { createRecord } from '../modules/operations/service.js';
await connectDatabase();
const email = process.env.BOOTSTRAP_EMAIL;
if (!email) throw new Error('Set BOOTSTRAP_EMAIL');
let admin = await User.findOne({ email });
if (!admin) {
  const secret = password.parse(process.env.BOOTSTRAP_PASSWORD);
  admin = await User.create({
    name: process.env.BOOTSTRAP_NAME ?? 'Platform Administrator',
    email,
    passwordHash: await bcrypt.hash(secret, 12),
    role: 'super_admin',
  });
}
if (admin.role !== 'super_admin')
  throw new Error(
    'Bootstrap email belongs to a hotel owner; choose a different administrator email',
  );
const user = {
  id: String(admin._id),
  name: String(admin.name),
  email: String(admin.email),
  role: 'super_admin' as const,
};
await Promise.all(Object.values(resources).map((m) => m.init()));
if (!(await resources['saas-plans'].exists({ name: 'Essential Monthly' })))
  await resources['saas-plans'].create({
    name: 'Essential Monthly',
    pricePaise: 99900,
    durationDays: 30,
    status: 'active',
    billingCycle: 'monthly',
  });
if (
  process.env.DEMO_OWNER_PASSWORD &&
  !(await User.exists({ email: process.env.DEMO_OWNER_EMAIL }))
) {
  const hotel = (await createRecord(
    user,
    'hotels',
    {
      name: 'Annapurna Kitchen',
      phone: '9876543210',
      email: '',
      address: 'Pune, Maharashtra',
      ownerName: 'Hotel Owner',
      ownerEmail: process.env.DEMO_OWNER_EMAIL,
      ownerPassword: process.env.DEMO_OWNER_PASSWORD,
      status: 'active',
      graceDays: 7,
    },
    `seed-hotel-${process.env.DEMO_OWNER_EMAIL}`,
  )) as { _id: unknown };
  const plan = await resources['saas-plans'].findOne({ name: 'Essential Monthly' }).lean();
  await createRecord(
    user,
    'saas-subscriptions',
    {
      hotelId: String(hotel._id),
      planId: String(plan?._id),
      startDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
    },
    `seed-subscription-${hotel._id}`,
  );
}
console.log('Bootstrap complete. Passwords were read from environment and were not printed.');
await mongoose.disconnect();
