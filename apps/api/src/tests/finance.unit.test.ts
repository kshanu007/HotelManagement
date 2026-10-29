import { describe, expect, it } from 'vitest';
import { allocate, outstanding, purchaseTotal, sumPaise } from '../shared/helpers/finance.js';
import { addDays, businessDate, periodDates } from '../shared/helpers/dates.js';
import { schemas } from '@annapurna/validation';
describe('financial calculations', () => {
  it('allocates a partial collection without losing paise', () =>
    expect(allocate(50001, [{ id: 'a', due: 100000 }])).toEqual({
      allocations: [{ invoiceId: 'a', amountPaise: 50001 }],
      creditPaise: 0,
    }));
  it('allocates oldest invoices first and preserves an advance', () =>
    expect(
      allocate(120000, [
        { id: 'a', due: 40000 },
        { id: 'b', due: 50000 },
      ]),
    ).toEqual({
      allocations: [
        { invoiceId: 'a', amountPaise: 40000 },
        { invoiceId: 'b', amountPaise: 50000 },
      ],
      creditPaise: 30000,
    }));
  it('does not allocate against settled invoices', () =>
    expect(allocate(100, [{ id: 'a', due: 0 }])).toEqual({ allocations: [], creditPaise: 100 }));
  it('computes vendor purchase items in integer units', () =>
    expect(
      purchaseTotal([
        { quantity: 3, ratePaise: 12345 },
        { quantity: 1, ratePaise: 99 },
      ]),
    ).toBe(37134));
  it('prevents negative dues', () => expect(outstanding(100, 200)).toBe(0));
  it('rejects floating point money and overflow', () => {
    expect(() => sumPaise([1.1])).toThrow();
    expect(() => sumPaise([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
  it('requires daily sale reconciliation', () =>
    expect(
      schemas.sales.safeParse({
        date: '2026-10-29',
        dineInPaise: 100,
        parcelPaise: 0,
        otherPaise: 0,
        cashPaise: 90,
        upiPaise: 0,
      }).success,
    ).toBe(false));
});
describe('business dates', () => {
  it('uses Indian midnight rather than UTC midnight', () =>
    expect(businessDate('Asia/Kolkata', new Date('2026-10-28T19:00:00Z'))).toBe('2026-10-29'));
  it('handles leap-year renewals', () => expect(addDays('2028-02-28', 2)).toBe('2028-03-01'));
  it('uses inclusive month and Monday week boundaries', () => {
    expect(periodDates('last-month', '2026-03-02')).toEqual(['2026-02-01', '2026-02-28']);
    expect(periodDates('this-week', '2026-10-29')).toEqual(['2026-10-26', '2026-11-01']);
  });
  it('rejects impossible dates', () =>
    expect(
      schemas.sales.safeParse({
        date: '2026-02-31',
        dineInPaise: 0,
        parcelPaise: 0,
        otherPaise: 0,
        cashPaise: 0,
        upiPaise: 0,
      }).success,
    ).toBe(false));
});
