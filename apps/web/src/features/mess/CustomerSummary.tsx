import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type { RecordData } from '@annapurna/types';
import { CalendarDays, Wallet, UserRound } from 'lucide-react';
import { resourceApi } from '../../services/resources';
import { keys } from '../../config/query.config';
import { resourcePath } from '../../config/mess.config';
import { currency, display, renewalStart } from '../../utils/format';
import { Button } from '../../components/ui/button';
import { ErrorState, Loading } from '../../components/feedback/QueryState';

export function CustomerSummary({
  customer,
  onClose,
}: {
  customer: RecordData;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const membership = useQuery({
    queryKey: keys.list('subscriptions', {
      customerId: customer._id,
      limit: 1,
      sort: 'endDate',
      order: 'desc',
    }),
    queryFn: ({ signal }) =>
      resourceApi.list(
        'subscriptions',
        { customerId: customer._id, limit: 1, sort: 'endDate', order: 'desc' },
        signal,
      ),
  });
  const balance = useQuery({
    queryKey: keys.list('customer-outstanding', { customerId: customer._id }),
    queryFn: ({ signal }) =>
      resourceApi.report(
        'mess-outstanding',
        { preset: 'today', customerId: customer._id, limit: 1 },
        signal,
      ),
  });
  const latest = membership.data?.items[0];
  const action = (resource: string) =>
    `${resourcePath(resource)}?${new URLSearchParams({ customerId: customer._id, action: 'create', ...(resource === 'subscriptions' ? { startDate: renewalStart(latest?.endDate) } : {}) })}`;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-secondary p-3 text-primary">
          <UserRound size={22} />
        </span>
        <div className="min-w-0">
          <p className="font-medium">
            {String(customer.customerCode)}{' '}
            <span className="badge ml-2">{String(customer.status)}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{String(customer.phone)}</p>
          {!!customer.email && (
            <p className="break-all text-sm text-muted-foreground">{String(customer.email)}</p>
          )}
          {!!customer.address && (
            <p className="mt-1 text-sm text-muted-foreground">{String(customer.address)}</p>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border p-4">
          <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays size={15} /> Latest membership
          </p>
          {membership.isPending ? (
            <Loading />
          ) : membership.error ? (
            <ErrorState error={membership.error} />
          ) : latest ? (
            <>
              <p className="font-medium">{String(latest.planName)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {display(latest.startDate)} to {display(latest.endDate)}
              </p>
            </>
          ) : (
            <p className="text-sm">No plan assigned yet</p>
          )}
        </section>
        <section className="rounded-lg border p-4">
          <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet size={15} /> Outstanding balance
          </p>
          {balance.isPending ? (
            <Loading />
          ) : balance.error ? (
            <ErrorState error={balance.error} />
          ) : (
            <>
              <p className="text-2xl font-semibold">
                {currency(balance.data?.totals.outstandingPaise ?? 0)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Across all unpaid invoices</p>
            </>
          )}
        </section>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={action('mess-payments')} onClick={onClose}>
            Collect payment
          </Link>
        </Button>
        <Button
          variant="outline"
          disabled={!membership.isSuccess}
          onClick={() => {
            navigate(action('subscriptions'));
            onClose();
          }}
        >
          Assign / renew plan
        </Button>
        <Button asChild variant="outline">
          <Link to={action('leaves')} onClick={onClose}>
            Add leave
          </Link>
        </Button>
      </div>
      <section className="border-t pt-4">
        <h3 className="mb-3 text-sm font-semibold">Customer history</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { resource: 'subscriptions', label: 'Memberships' },
            { resource: 'attendance', label: 'Attendance' },
            { resource: 'mess-payments', label: 'Payments' },
            { resource: 'mess-invoices', label: 'Invoices' },
            { resource: 'mess-refunds', label: 'Refunds' },
            { resource: 'leaves', label: 'Leave' },
          ].map((item) => (
            <Button asChild key={item.resource} variant="ghost" size="sm">
              <Link
                to={`${resourcePath(item.resource)}?customerId=${customer._id}`}
                onClick={onClose}
              >
                {item.label} →
              </Link>
            </Button>
          ))}
          <Button asChild variant="ghost" size="sm">
            <Link to={`/reports?customerId=${customer._id}`} onClick={onClose}>
              Full ledger →
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
