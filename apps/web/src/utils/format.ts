import { APP } from '@annapurna/constants';
import { format } from 'date-fns';
export const currency = (paise: unknown) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: APP.currency,
    maximumFractionDigits: 2,
  }).format(Number(paise ?? 0) / 100);
export const label = (s: string) =>
  s
    .replace(/Paise$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('-', ' ')
    .replace(/^./, (v) => v.toUpperCase());
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: APP.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function renewalStart(endDate: unknown) {
  const current = today();
  if (typeof endDate !== 'string' || endDate < current) return current;
  const next = new Date(`${endDate}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
export function display(v: unknown, key = '') {
  if (v == null || v === '') return '—';
  if (key.endsWith('Paise')) return currency(v);
  if (typeof v === 'object') return JSON.stringify(v);
  if (key === 'createdAt' || key === 'updatedAt')
    return format(new Date(String(v)), 'dd MMM yyyy, HH:mm');
  return String(v);
}
export function rupeesToPaise(value: string) {
  if (!/^\d*(\.\d{0,2})?$/.test(value)) return undefined;
  const [rupees = '', decimal = ''] = value.split('.');
  const result = BigInt(rupees || 0) * 100n + BigInt(decimal.padEnd(2, '0'));
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : undefined;
}
