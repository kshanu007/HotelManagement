import mongoose, { Schema } from 'mongoose';
export interface DatabaseRecord extends Record<string, unknown> {
  _id: mongoose.Types.ObjectId;
  tenantId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  passwordHash?: string;
  passwordVersion?: number;
  resetHash?: string;
  resetExpires?: Date;
  ownerId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  familyId?: string;
  tokenHash?: string;
  expiresAt?: Date;
  revokedAt?: Date;
  usedAt?: Date;
  graceDays?: number;
  startDate?: string;
  endDate?: string;
  balancePaise?: number;
  timezone?: string;
  requestHash?: string;
  response?: unknown;
}
const ref = { type: Schema.Types.ObjectId, required: true };
const amount = { type: Number, min: 0, required: true, validate: Number.isSafeInteger };
const base = {
  tenantId: { ...ref },
  deletedAt: { type: Date, default: null },
  voidedAt: { type: Date, default: null },
  supersededBy: Schema.Types.ObjectId,
};
const contact = {
  name: { type: String, required: true },
  phone: String,
  email: String,
  address: String,
  status: { type: String, default: 'active' },
};
function model(
  name: string,
  fields: Record<string, unknown>,
  indexes: { keys: Record<string, 1 | -1>; unique?: boolean }[] = [],
  tenant = true,
) {
  const s = new Schema<DatabaseRecord>(
    { ...(tenant ? base : {}), ...fields },
    { timestamps: true, strict: 'throw' },
  );
  if (tenant) {
    s.index({ tenantId: 1, createdAt: -1 });
    if ('date' in fields) s.index({ tenantId: 1, date: -1 });
    if ('endDate' in fields) s.index({ tenantId: 1, endDate: 1 });
  }
  for (const i of indexes) s.index(i.keys, { unique: i.unique ?? false });
  return mongoose.model<DatabaseRecord>(name, s);
}
export const User = model(
  'User',
  {
    name: String,
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['super_admin', 'hotel_owner'], required: true },
    tenantId: Schema.Types.ObjectId,
    status: { type: String, default: 'active' },
    passwordVersion: { type: Number, default: 0 },
    resetHash: { type: String, select: false },
    resetExpires: Date,
  },
  [],
  false,
);
export const Tenant = model(
  'Tenant',
  { ...contact, ownerId: ref, graceDays: { type: Number, default: 7 } },
  [],
  false,
);
export const RefreshSession = model(
  'RefreshSession',
  {
    userId: ref,
    familyId: String,
    tokenHash: { type: String, unique: true },
    expiresAt: Date,
    revokedAt: Date,
    usedAt: Date,
  },
  [],
  false,
);
RefreshSession.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshSession.schema.index({ familyId: 1, revokedAt: 1 });
export const RefreshFamily = model(
  'RefreshFamily',
  {
    familyId: { type: String, unique: true },
    userId: ref,
    expiresAt: Date,
    revokedAt: Date,
    version: { type: Number, default: 0 },
  },
  [],
  false,
);
RefreshFamily.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AuditLog = model(
  'AuditLog',
  {
    tenantId: Schema.Types.ObjectId,
    userId: Schema.Types.ObjectId,
    action: String,
    resource: String,
    recordId: String,
    details: Schema.Types.Mixed,
    ip: String,
  },
  [],
  false,
);
export const HotelSettings = model(
  'HotelSettings',
  {
    name: String,
    address: String,
    phone: String,
    email: String,
    logo: String,
    lunchTime: String,
    dinnerTime: String,
    timezone: String,
    paymentMethods: [String],
  },
  [{ keys: { tenantId: 1 }, unique: true }],
);
export const PlatformSettings = model(
  'PlatformSettings',
  { key: { type: String, unique: true }, name: String, supportEmail: String },
  [],
  false,
);
const plan = {
  name: { type: String, required: true },
  pricePaise: amount,
  durationDays: Number,
  status: { type: String, default: 'active' },
};
export const SaaSPlan = model('SaaSPlan', { ...plan, billingCycle: String }, [], false);
export const MessCustomer = model('MessCustomer', { ...contact, customerCode: String }, [
  { keys: { tenantId: 1, customerCode: 1 }, unique: true },
]);
export const MessPlan = model('MessPlan', { ...plan, meal: String, diet: String });
const sub = {
  planId: ref,
  startDate: String,
  endDate: String,
  pricePaise: amount,
  planName: String,
  meal: String,
  diet: String,
};
export const MessSubscription = model('MessSubscription', { ...sub, customerId: ref });
export const TenantSubscription = model('TenantSubscription', { ...sub, hotelId: ref }, [], false);
const invoice = {
  partyId: ref,
  subscriptionId: ref,
  serviceStart: String,
  serviceEnd: String,
  planId: ref,
  planName: String,
  date: String,
  totalPaise: amount,
  paidPaise: { ...amount, default: 0 },
  creditedPaise: { ...amount, default: 0 },
  description: String,
};
export const MessInvoice = model('MessInvoice', invoice, [
  { keys: { tenantId: 1, subscriptionId: 1 }, unique: true },
]);
export const SaaSInvoice = model(
  'SaaSInvoice',
  invoice,
  [{ keys: { subscriptionId: 1 }, unique: true }],
  false,
);
const allocation = new Schema({ invoiceId: ref, amountPaise: amount }, { _id: false });
const payment = {
  partyId: ref,
  amountPaise: amount,
  method: String,
  date: String,
  note: String,
  idempotencyKey: String,
  requestHash: String,
  allocations: [allocation],
  creditPaise: { ...amount, default: 0 },
  receiptNo: String,
};
export const MessPayment = model('MessPayment', payment, [
  { keys: { tenantId: 1, idempotencyKey: 1 }, unique: true },
]);
export const SaaSPayment = model(
  'SaaSPayment',
  payment,
  [{ keys: { idempotencyKey: 1 }, unique: true }],
  false,
);
export const CustomerCreditLedger = model(
  'CustomerCreditLedger',
  {
    partyId: ref,
    kind: String,
    balancePaise: { ...amount, default: 0 },
    version: { type: Number, default: 0 },
  },
  [{ keys: { tenantId: 1, partyId: 1, kind: 1 }, unique: true }],
);
export const MessAttendance = model(
  'MessAttendance',
  { customerId: ref, date: String, meal: String, status: String, note: String },
  [{ keys: { tenantId: 1, customerId: 1, date: 1, meal: 1 }, unique: true }],
);
export const MessLeave = model('MessLeave', {
  customerId: ref,
  startDate: String,
  endDate: String,
  meal: String,
  note: String,
  status: { type: String, default: 'active' },
});
export const MessAdjustment = model('MessAdjustment', {
  date: String,
  customerId: ref,
  subscriptionId: ref,
  type: String,
  amountPaise: amount,
  days: Number,
  note: String,
});
export const DailySale = model('DailySale', {
  date: String,
  dineInPaise: amount,
  parcelPaise: amount,
  otherPaise: amount,
  cashPaise: amount,
  upiPaise: amount,
  note: String,
});
export const Vendor = model('Vendor', { ...contact, categoryId: Schema.Types.ObjectId });
export const VendorCategory = model('VendorCategory', { name: String, status: String }, [
  { keys: { tenantId: 1, name: 1 }, unique: true },
]);
export const ExpenseCategory = model('ExpenseCategory', { name: String, status: String }, [
  { keys: { tenantId: 1, name: 1 }, unique: true },
]);
export const VendorPurchase = model('VendorPurchase', {
  vendorId: ref,
  date: String,
  totalPaise: amount,
  paidPaise: { ...amount, default: 0 },
  creditedPaise: { ...amount, default: 0 },
  note: String,
});
export const VendorPurchaseItem = model('VendorPurchaseItem', {
  purchaseId: ref,
  name: String,
  quantity: Number,
  unit: String,
  ratePaise: amount,
});
export const VendorPayment = model('VendorPayment', payment, [
  { keys: { tenantId: 1, idempotencyKey: 1 }, unique: true },
]);
export const Expense = model('Expense', {
  date: String,
  categoryId: ref,
  description: String,
  amountPaise: amount,
  method: String,
  note: String,
});
export const Idempotency = model(
  'Idempotency',
  { key: String, resource: String, requestHash: String, response: Schema.Types.Mixed },
  [{ keys: { tenantId: 1, key: 1, resource: 1 }, unique: true }],
);
const refund = {
  paymentId: ref,
  partyId: ref,
  amountPaise: amount,
  method: String,
  date: String,
  note: String,
};
export const MessRefund = model('MessRefund', refund);
export const VendorRefund = model('VendorRefund', refund);
export const SaaSRefund = model('SaaSRefund', refund, [], false);
export const resources = {
  corrections: model('FinancialCorrection', {
    resource: String,
    originalId: ref,
    replacementId: ref,
    reason: String,
    before: Schema.Types.Mixed,
  }),
  'mess-refunds': MessRefund,
  'vendor-refunds': VendorRefund,
  'saas-refunds': SaaSRefund,
  hotels: Tenant,
  'saas-plans': SaaSPlan,
  'saas-subscriptions': TenantSubscription,
  'saas-invoices': SaaSInvoice,
  'saas-payments': SaaSPayment,
  customers: MessCustomer,
  'mess-plans': MessPlan,
  subscriptions: MessSubscription,
  attendance: MessAttendance,
  leaves: MessLeave,
  adjustments: MessAdjustment,
  'mess-invoices': MessInvoice,
  'mess-payments': MessPayment,
  sales: DailySale,
  vendors: Vendor,
  'vendor-categories': VendorCategory,
  purchases: VendorPurchase,
  'vendor-payments': VendorPayment,
  expenses: Expense,
  'expense-categories': ExpenseCategory,
};
export type Resource = keyof typeof resources;
