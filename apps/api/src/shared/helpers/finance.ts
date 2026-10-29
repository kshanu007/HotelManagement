export function sumPaise(values: number[]) {
  return values.reduce((total, n) => {
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(total + n))
      throw new Error('Unsafe money value');
    return total + n;
  }, 0);
}
export function outstanding(total: number, paid: number) {
  return Math.max(0, sumPaise([total, -paid]));
}
export function allocate(amount: number, invoices: { id: string; due: number }[]) {
  let remaining = amount;
  const allocations: { invoiceId: string; amountPaise: number }[] = [];
  for (const invoice of invoices) {
    const used = Math.min(remaining, invoice.due);
    if (used > 0) allocations.push({ invoiceId: invoice.id, amountPaise: used });
    remaining -= used;
  }
  return { allocations, creditPaise: remaining };
}
export function purchaseTotal(items: { quantity: number; ratePaise: number }[]) {
  return sumPaise(
    items.map((i) => {
      const n = i.quantity * i.ratePaise;
      if (!Number.isSafeInteger(n)) throw new Error('Unsafe purchase amount');
      return n;
    }),
  );
}
