export const APP = {
  name: 'Annapurna',
  subtitle: 'Hotel & mess workspace',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  apiPrefix: '/api/v1',
  pageSize: 20,
} as const;
export const ROLES = { admin: 'super_admin', owner: 'hotel_owner' } as const;
export const PAYMENT_METHODS = ['cash', 'upi'] as const;
export const STATUSES = ['active', 'inactive', 'suspended'] as const;
export const MEALS = ['lunch', 'dinner', 'both'] as const;
export const HOTEL_RESOURCES = [
  'corrections',
  'mess-refunds',
  'vendor-refunds',
  'customers',
  'mess-plans',
  'subscriptions',
  'attendance',
  'leaves',
  'adjustments',
  'mess-invoices',
  'mess-payments',
  'sales',
  'vendors',
  'vendor-categories',
  'purchases',
  'vendor-payments',
  'expenses',
  'expense-categories',
] as const;
export const PLATFORM_RESOURCES = [
  'saas-refunds',
  'hotels',
  'saas-plans',
  'saas-subscriptions',
  'saas-invoices',
  'saas-payments',
] as const;
export const REPORTS = [
  'customer-ledger',
  'daily-sales',
  'mess-collection',
  'mess-outstanding',
  'attendance',
  'members',
  'vendor-purchases',
  'vendor-payments',
  'vendor-outstanding',
  'vendor-ledger',
  'expenses',
  'income',
  'profit-loss',
  'cash-upi',
  'saas-revenue',
  'hotel-registrations',
] as const;
export const QUERY = { staleTime: 30_000, retry: 1 };
export const RATE_LIMIT_RESPONSE = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
};
export const ERROR_CODES = {
  validation: 'VALIDATION_ERROR',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  missing: 'NOT_FOUND',
  conflict: 'CONFLICT',
  internal: 'INTERNAL_ERROR',
} as const;
