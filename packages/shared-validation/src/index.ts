import { z } from 'zod';
import { MEALS, PAYMENT_METHODS, STATUSES } from '@annapurna/constants';
export const id = z.string().regex(/^[a-f\d]{24}$/i, 'Select a valid record');
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Invalid calendar date',
  );
export const money = z.number().int().nonnegative().max(1_000_000_000_000);
const text = z.string().trim().min(1).max(200);
const note = z.string().trim().max(2000).default('');
const status = z.enum(STATUSES).default('active');
const method = z.enum(PAYMENT_METHODS);
const contact = {
  name: text,
  phone: z.string().regex(/^\+?[\d\s-]{7,18}$/),
  email: z.string().email().or(z.literal('')).default(''),
  address: note,
  status,
};
export const password = z
  .string()
  .min(12)
  .max(128)
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/\d/, 'Include a number');
export const loginSchema = z
  .object({ email: z.string().email(), password: z.string().min(1).max(128) })
  .strict();
export const hotelSchema = z
  .object({
    ...contact,
    ownerName: text,
    ownerEmail: z.string().email(),
    ownerPassword: password,
    graceDays: z.number().int().min(0).max(30).default(7),
  })
  .strict();
const plan = {
  name: text,
  pricePaise: money,
  durationDays: z.number().int().min(1).max(730),
  status,
};
const subscription = { planId: id, startDate: date };
const payment = {
  amountPaise: money.refine((v) => v > 0, 'Amount must be positive'),
  method,
  date,
  note,
};
export const purchaseItem = z
  .object({
    name: text,
    quantity: z.number().int().min(1).max(100000),
    unit: text,
    ratePaise: money,
  })
  .strict();
export const schemas = {
  'mess-refunds': z.object({ ...payment, paymentId: id, note: text }).strict(),
  'vendor-refunds': z.object({ ...payment, paymentId: id, note: text }).strict(),
  'saas-refunds': z.object({ ...payment, paymentId: id, note: text }).strict(),
  customers: z.object({ ...contact, customerCode: text }).strict(),
  'mess-plans': z
    .object({ ...plan, meal: z.enum(MEALS), diet: z.enum(['veg', 'non-veg', 'mixed']) })
    .strict(),
  subscriptions: z.object({ ...subscription, customerId: id }).strict(),
  attendance: z
    .object({
      customerId: id,
      date,
      meal: z.enum(['lunch', 'dinner']),
      status: z.enum(['present', 'absent']),
      note,
    })
    .strict(),
  leaves: z
    .object({ customerId: id, startDate: date, endDate: date, meal: z.enum(MEALS), note })
    .strict()
    .refine((v) => v.endDate >= v.startDate, {
      message: 'End date precedes start date',
      path: ['endDate'],
    }),
  adjustments: z
    .object({
      customerId: id,
      subscriptionId: id,
      type: z.enum(['credit', 'extension']),
      amountPaise: money.default(0),
      days: z.number().int().min(0).max(365).default(0),
      note: text,
    })
    .strict()
    .refine(
      (v) => (v.type === 'credit' ? v.amountPaise > 0 : v.days > 0),
      'Supply a positive credit or extension',
    ),
  'mess-payments': z.object({ ...payment, customerId: id }).strict(),
  sales: z
    .object({
      date,
      dineInPaise: money,
      parcelPaise: money,
      otherPaise: money,
      cashPaise: money,
      upiPaise: money,
      note,
    })
    .strict()
    .refine(
      (v) => v.dineInPaise + v.parcelPaise + v.otherPaise === v.cashPaise + v.upiPaise,
      'Cash and UPI must equal sales total',
    ),
  vendors: z.object({ ...contact, categoryId: id.optional() }).strict(),
  'vendor-categories': z.object({ name: text, status }).strict(),
  purchases: z
    .object({ vendorId: id, date, items: z.array(purchaseItem).min(1).max(100), note })
    .strict(),
  'vendor-payments': z.object({ ...payment, vendorId: id }).strict(),
  expenses: z
    .object({
      date,
      categoryId: id,
      description: text,
      amountPaise: money.refine((v) => v > 0),
      method,
      note,
    })
    .strict(),
  'expense-categories': z.object({ name: text, status }).strict(),
  hotels: hotelSchema,
  'saas-plans': z.object({ ...plan, billingCycle: z.enum(['monthly', 'yearly']) }).strict(),
  'saas-subscriptions': z.object({ ...subscription, hotelId: id }).strict(),
  'saas-payments': z.object({ ...payment, hotelId: id }).strict(),
};
export const customerEnrollmentSchema = schemas.customers.extend(subscription).strict();
export const attendanceRosterQuery = z.object({
  date,
  meal: z.enum(['lunch', 'dinner']),
  customerId: id.optional(),
  q: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).default(1),
});
export const settingsSchema = z
  .object({
    name: text,
    address: note,
    phone: z.string().max(20),
    email: z.string().email().or(z.literal('')),
    logo: z.string().url().or(z.literal('')).default(''),
    lunchTime: z.string().regex(/^\d{2}:\d{2}$/),
    dinnerTime: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid timezone'),
    paymentMethods: z.array(method).min(1),
  })
  .strict();
