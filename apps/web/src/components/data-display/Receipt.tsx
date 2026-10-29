import type { RecordData } from '@annapurna/types';
import { currency, display } from '../../utils/format';
export function Receipt({ record, settings }: { record: RecordData; settings?: RecordData }) {
  const labels = record.displayLabels as Record<string, string> | undefined;
  return (
    <article className="rounded-lg border p-6">
      <div className="border-b pb-5 text-center">
        {!!settings?.logo && (
          <img
            src={String(settings.logo)}
            alt="Hotel logo"
            className="mx-auto mb-3 size-16 rounded-lg object-contain"
          />
        )}
        <h2 className="font-serif text-2xl">{String(settings?.name ?? 'Annapurna')}</h2>
        {!!settings?.address && (
          <p className="mt-2 text-xs text-muted-foreground">{String(settings.address)}</p>
        )}
        <p className="mt-3 text-xs uppercase tracking-widest">
          {record.receiptNo ? 'Payment receipt' : 'Refund receipt'}
        </p>
      </div>
      <dl className="my-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Receipt</dt>
          <dd className="mt-1 break-all">{String(record.receiptNo ?? record._id)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Date</dt>
          <dd className="mt-1">{display(record.date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Account</dt>
          <dd className="mt-1 font-medium">{labels?.partyId ?? String(record.partyId)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Payment method</dt>
          <dd className="mt-1 uppercase">{String(record.method)}</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between rounded-lg bg-muted p-4">
        <span className="text-sm">Amount</span>
        <strong className="text-2xl">{currency(record.amountPaise)}</strong>
      </div>
      {Number(record.creditPaise) > 0 && (
        <p className="mt-4 text-sm">Advance at time of payment: {currency(record.creditPaise)}</p>
      )}
      {!!record.note && <p className="mt-4 text-sm text-muted-foreground">{String(record.note)}</p>}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Thank you. Please retain this receipt for your records.
      </p>
    </article>
  );
}
