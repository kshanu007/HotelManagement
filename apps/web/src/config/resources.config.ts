import { today } from '../utils/format';
export interface Field {
  key: string;
  label?: string;
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'money'
    | 'number'
    | 'date'
    | 'textarea'
    | 'select'
    | 'items'
    | 'checks';
  options?: string[];
  ref?: string;
  optional?: boolean;
}
export interface ResourceConfig {
  title: string;
  description: string;
  fields: Field[];
  columns: string[];
  editable?: boolean;
  readOnly?: boolean;
}
const contact: Field[] = [
  { key: 'name' },
  { key: 'phone' },
  { key: 'email', type: 'email', optional: true },
  { key: 'address', type: 'textarea', optional: true },
  { key: 'status', type: 'select', options: ['active', 'inactive'] },
];
const plan: Field[] = [
  { key: 'name' },
  { key: 'pricePaise', label: 'Plan price (₹)', type: 'money' },
  { key: 'durationDays', type: 'number' },
  { key: 'status', type: 'select', options: ['active', 'inactive'] },
];
const payment: Field[] = [
  { key: 'date', type: 'date' },
  { key: 'amountPaise', label: 'Amount (₹)', type: 'money' },
  { key: 'method', type: 'select', options: ['cash', 'upi'] },
  { key: 'note', type: 'textarea', optional: true },
];
export const resourceConfig: Record<string, ResourceConfig> = {
  corrections: {
    title: 'Financial corrections',
    description: 'Every correction preserves its original record and reason.',
    fields: [],
    readOnly: true,
    columns: ['resource', 'originalId', 'replacementId', 'reason', 'createdAt'],
  },
  'mess-refunds': {
    title: 'Customer refunds',
    description: 'Return a payment with a separate, audited refund record.',
    fields: [
      { key: 'paymentId', ref: 'mess-payments' },
      ...payment.map((f) =>
        f.key === 'note' ? { ...f, label: 'Refund reason', optional: false } : f,
      ),
    ],
    columns: ['partyId', 'paymentId', 'amountPaise', 'method', 'date', 'note'],
  },
  'vendor-refunds': {
    title: 'Vendor refunds',
    description: 'Record money returned by a vendor. Balances are reconciled automatically.',
    fields: [
      { key: 'paymentId', ref: 'vendor-payments' },
      ...payment.map((f) =>
        f.key === 'note' ? { ...f, label: 'Refund reason', optional: false } : f,
      ),
    ],
    columns: ['partyId', 'paymentId', 'amountPaise', 'method', 'date', 'note'],
  },
  'saas-refunds': {
    title: 'Platform refunds',
    description: 'Return a hotel subscription payment with an immutable refund record.',
    fields: [
      { key: 'paymentId', ref: 'saas-payments' },
      ...payment.map((f) =>
        f.key === 'note' ? { ...f, label: 'Refund reason', optional: false } : f,
      ),
    ],
    columns: ['partyId', 'paymentId', 'amountPaise', 'method', 'date', 'note'],
  },
  hotels: {
    title: 'Hotels',
    description: 'Independent kitchens. One connected platform.',
    editable: true,
    fields: [
      ...contact.filter((f) => f.key !== 'status'),
      { key: 'status', type: 'select', options: ['active', 'inactive', 'suspended'] },
      { key: 'ownerName' },
      { key: 'ownerEmail', type: 'email' },
      { key: 'ownerPassword', type: 'password' },
      { key: 'graceDays', type: 'number' },
    ],
    columns: ['name', 'phone', 'status', 'createdAt'],
  },
  'saas-plans': {
    title: 'Platform plans',
    description: 'Simple subscriptions for growing hospitality businesses.',
    editable: true,
    fields: [...plan, { key: 'billingCycle', type: 'select', options: ['monthly', 'yearly'] }],
    columns: ['name', 'pricePaise', 'durationDays', 'billingCycle', 'status'],
  },
  'saas-subscriptions': {
    title: 'Hotel subscriptions',
    description: 'Assign a plan or renew with a new subscription period.',
    fields: [
      { key: 'hotelId', ref: 'hotels' },
      { key: 'planId', ref: 'saas-plans' },
      { key: 'startDate', type: 'date' },
    ],
    columns: ['hotelId', 'planName', 'startDate', 'endDate', 'pricePaise'],
  },
  'saas-invoices': {
    title: 'Platform invoices',
    description: 'Immutable billing history for hotel subscriptions.',
    fields: [],
    readOnly: true,
    columns: ['partyId', 'description', 'totalPaise', 'paidPaise', 'date'],
  },
  'saas-payments': {
    title: 'Platform collections',
    description: 'Record cash and UPI payments, including partial payments.',
    fields: [{ key: 'hotelId', ref: 'hotels' }, ...payment],
    columns: ['receiptNo', 'partyId', 'amountPaise', 'method', 'date'],
  },
  customers: {
    title: 'Mess customers',
    description: 'Good food starts with knowing your people.',
    editable: true,
    fields: [{ key: 'customerCode', label: 'Customer ID' }, ...contact],
    columns: ['customerCode', 'name', 'phone', 'status'],
  },
  'mess-plans': {
    title: 'Meal plans',
    description: 'Flexible lunch and dinner memberships.',
    editable: true,
    fields: [
      ...plan,
      { key: 'meal', type: 'select', options: ['lunch', 'dinner', 'both'] },
      { key: 'diet', type: 'select', options: ['veg', 'non-veg', 'mixed'] },
    ],
    columns: ['name', 'meal', 'diet', 'pricePaise', 'durationDays', 'status'],
  },
  subscriptions: {
    title: 'Memberships',
    description: 'Assign, renew and track every mess membership.',
    fields: [
      { key: 'customerId', ref: 'customers' },
      { key: 'planId', ref: 'mess-plans' },
      { key: 'startDate', type: 'date' },
    ],
    columns: ['customerId', 'planName', 'startDate', 'endDate', 'pricePaise'],
  },
  attendance: {
    title: 'Meal attendance',
    description: 'A reliable daily record, one meal at a time.',
    editable: true,
    fields: [
      { key: 'customerId', ref: 'customers' },
      { key: 'date', type: 'date' },
      { key: 'meal', type: 'select', options: ['lunch', 'dinner'] },
      { key: 'status', type: 'select', options: ['present', 'absent'] },
      { key: 'note', type: 'textarea', optional: true },
    ],
    columns: ['customerId', 'date', 'meal', 'status', 'note'],
  },
  leaves: {
    title: 'Customer leave',
    description: 'Keep meal breaks organised. Credits are applied separately.',
    fields: [
      { key: 'customerId', ref: 'customers' },
      { key: 'startDate', type: 'date' },
      { key: 'endDate', type: 'date' },
      { key: 'meal', type: 'select', options: ['lunch', 'dinner', 'both'] },
      { key: 'note', type: 'textarea', optional: true },
    ],
    columns: ['customerId', 'startDate', 'endDate', 'meal', 'status'],
  },
  adjustments: {
    title: 'Credits & extensions',
    description: 'Audited, manual adjustments to customer entitlements.',
    fields: [
      { key: 'customerId', ref: 'customers' },
      { key: 'subscriptionId', ref: 'subscriptions' },
      { key: 'type', type: 'select', options: ['credit', 'extension'] },
      { key: 'amountPaise', type: 'money', label: 'Credit amount (₹)' },
      { key: 'days', type: 'number' },
      { key: 'note', label: 'Reason', type: 'textarea' },
    ],
    columns: ['customerId', 'type', 'amountPaise', 'days', 'note'],
  },
  'mess-invoices': {
    title: 'Mess invoices',
    description: 'Plan price snapshots and allocation balances.',
    fields: [],
    readOnly: true,
    columns: ['partyId', 'description', 'totalPaise', 'paidPaise', 'creditedPaise', 'date'],
  },
  'mess-payments': {
    title: 'Mess collections',
    description: 'Full, partial and advance payments in one clear ledger.',
    fields: [{ key: 'customerId', ref: 'customers' }, ...payment],
    columns: ['receiptNo', 'partyId', 'amountPaise', 'creditPaise', 'method', 'date'],
  },
  sales: {
    editable: true,
    title: 'Daily hotel sales',
    description: 'Dine-in, parcel and other sales. Mess income is separate.',
    fields: [
      { key: 'date', type: 'date' },
      ...['dineInPaise', 'parcelPaise', 'otherPaise', 'cashPaise', 'upiPaise'].map((key) => ({
        key,
        type: 'money' as const,
      })),
      { key: 'note', type: 'textarea', optional: true },
    ],
    columns: ['date', 'dineInPaise', 'parcelPaise', 'otherPaise', 'cashPaise', 'upiPaise'],
  },
  vendors: {
    title: 'Vendors',
    description: 'Build lasting relationships with your suppliers.',
    editable: true,
    fields: [...contact, { key: 'categoryId', ref: 'vendor-categories', optional: true }],
    columns: ['name', 'phone', 'categoryId', 'status'],
  },
  'vendor-categories': {
    title: 'Vendor categories',
    description: 'Organise your suppliers.',
    editable: true,
    fields: [{ key: 'name' }, { key: 'status', type: 'select', options: ['active', 'inactive'] }],
    columns: ['name', 'status'],
  },
  purchases: {
    editable: true,
    title: 'Vendor purchases',
    description: 'Record items purchased on credit; record payments separately.',
    fields: [
      { key: 'vendorId', ref: 'vendors' },
      { key: 'date', type: 'date' },
      { key: 'items', type: 'items' },
      { key: 'note', type: 'textarea', optional: true },
    ],
    columns: ['vendorId', 'date', 'totalPaise', 'paidPaise', 'note'],
  },
  'vendor-payments': {
    title: 'Vendor payments',
    description: 'Settle dues or record an advance for your next purchase.',
    fields: [{ key: 'vendorId', ref: 'vendors' }, ...payment],
    columns: ['receiptNo', 'partyId', 'date', 'amountPaise', 'creditPaise', 'method'],
  },
  expenses: {
    editable: true,
    title: 'Operating expenses',
    description: 'Rent, utilities and overheads. Vendor purchases stay separate.',
    fields: [
      { key: 'date', type: 'date' },
      { key: 'categoryId', ref: 'expense-categories' },
      { key: 'description' },
      { key: 'amountPaise', type: 'money' },
      { key: 'method', type: 'select', options: ['cash', 'upi'] },
      { key: 'note', type: 'textarea', optional: true },
    ],
    columns: ['date', 'description', 'categoryId', 'amountPaise', 'method'],
  },
  'expense-categories': {
    title: 'Expense categories',
    description: 'Keep every operating cost in the right place.',
    editable: true,
    fields: [{ key: 'name' }, { key: 'status', type: 'select', options: ['active', 'inactive'] }],
    columns: ['name', 'status'],
  },
};
export function defaults(fields: Field[]) {
  return Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.type === 'date'
        ? today()
        : f.type === 'money'
          ? 0
          : f.type === 'number'
            ? f.key === 'durationDays'
              ? 30
              : f.key === 'graceDays'
                ? 7
                : 0
            : f.type === 'select'
              ? f.options?.[0]
              : f.type === 'items'
                ? [{ name: '', quantity: 1, unit: 'kg', ratePaise: 0 }]
                : '',
    ]),
  );
}
