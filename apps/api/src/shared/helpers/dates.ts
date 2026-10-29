import { APP } from '@annapurna/constants';
export function businessDate(timezone: string = APP.timezone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function periodDates(preset: string, today: string) {
  const d = new Date(`${today}T12:00:00Z`);
  const month = (offset: number) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1, 12))
      .toISOString()
      .slice(0, 10);
  const year = d.getUTCFullYear();
  switch (preset) {
    case 'yesterday':
      return [addDays(today, -1), addDays(today, -1)];
    case 'this-week': {
      const start = addDays(today, -((d.getUTCDay() + 6) % 7));
      return [start, addDays(start, 6)];
    }
    case 'last-week': {
      const start = addDays(today, -((d.getUTCDay() + 6) % 7) - 7);
      return [start, addDays(start, 6)];
    }
    case 'this-month':
      return [month(0), addDays(month(1), -1)];
    case 'last-month':
      return [month(-1), addDays(month(0), -1)];
    case 'this-year':
      return [`${year}-01-01`, `${year}-12-31`];
    case 'last-year':
      return [`${year - 1}-01-01`, `${year - 1}-12-31`];
    default:
      return [today, today];
  }
}
