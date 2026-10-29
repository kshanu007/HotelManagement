import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { REPORTS, ROLES } from '@annapurna/constants';
import { toast } from 'sonner';
import { useSession } from '../../stores/session';
import { resourceApi } from '../../services/resources';
import { keys } from '../../config/query.config';
import { Button } from '../../components/ui/button';
import { DataTable } from '../../components/data-display/DataTable';
import { ErrorState } from '../../components/feedback/QueryState';
import { ReferenceSelect } from '../../components/forms/RecordForm';
import { label, currency, today } from '../../utils/format';
export default function ReportsPage() {
  const admin = useSession((s) => s.user?.role === ROLES.admin);
  const [url] = useSearchParams();
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});
  const [name, setName] = useState(
      admin
        ? 'saas-revenue'
        : url.get('vendorId')
          ? 'vendor-ledger'
          : url.get('customerId')
            ? 'customer-ledger'
            : 'daily-sales',
    ),
    [preset, setPreset] = useState('this-month'),
    [from, setFrom] = useState(today()),
    [to, setTo] = useState(today()),
    [page, setPage] = useState(1),
    [customerId, setCustomer] = useState(url.get('customerId') ?? ''),
    [vendorId, setVendor] = useState(url.get('vendorId') ?? ''),
    [method, setMethod] = useState(''),
    [busy, setBusy] = useState(false);
  const params = {
    preset,
    ...(preset === 'custom' ? { from, to } : {}),
    ...(customerId ? { customerId } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(method ? { method } : {}),
    ...Object.fromEntries(Object.entries(extraFilters).filter(([, value]) => value)),
    page,
    limit: 20,
  };
  const query = useQuery({
    queryKey: keys.list(`report-${name}`, params),
    queryFn: ({ signal }) => resourceApi.report(name, params, signal),
  });
  const data = query.data;
  const columns = data?.items[0]
    ? Object.keys(data.items[0])
        .filter(
          (k) => !['_id', '__v', 'tenantId', 'deletedAt', 'updatedAt', 'createdAt'].includes(k),
        )
        .slice(0, 9)
    : [];
  async function download(format: string) {
    setBusy(true);
    try {
      await resourceApi.export(name, format, params);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Know your numbers</p>
          <h1 className="page-title">Reports & insights</h1>
          <p className="mt-2 text-muted-foreground">
            The same filters. The same figures. On screen and in every export.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!data}
            onClick={() => {
              void resourceApi
                .printReport(name, params)
                .catch((error: Error) => toast.error(error.message));
            }}
          >
            <Printer /> Print
          </Button>
          {['csv', 'xlsx', 'pdf'].map((f) => (
            <Button
              key={f}
              variant="outline"
              disabled={busy || !data}
              onClick={() => void download(f)}
            >
              <Download />
              {f.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
      <div className="card mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="field">
          <label htmlFor="report">Report</label>
          <select
            id="report"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPage(1);
              setCustomer('');
              setVendor('');
              setMethod('');
              setExtraFilters({});
            }}
          >
            {REPORTS.filter((r) =>
              admin
                ? r.startsWith('saas-') || r === 'hotel-registrations'
                : !r.startsWith('saas-') && r !== 'hotel-registrations',
            ).map((r) => (
              <option key={r} value={r}>
                {label(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="period">Period</label>
          <select
            id="period"
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              setPage(1);
            }}
          >
            {[
              'today',
              'yesterday',
              'this-week',
              'last-week',
              'this-month',
              'last-month',
              'this-year',
              'last-year',
              'custom',
            ].map((p) => (
              <option key={p} value={p}>
                {label(p)}
              </option>
            ))}
          </select>
        </div>
        {preset === 'custom' && (
          <>
            <div className="field">
              <label htmlFor="from">From</label>
              <input
                type="date"
                id="from"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="to">To</label>
              <input
                type="date"
                id="to"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
        {!admin &&
          (name.startsWith('mess-') ||
            ['attendance', 'members', 'customer-ledger'].includes(name)) && (
            <div className="field">
              <label htmlFor="customer-filter">Customer</label>
              <ReferenceSelect
                resource="customers"
                id="customer-filter"
                value={customerId}
                optional
                onChange={(v) => {
                  setCustomer(v);
                  setPage(1);
                }}
              />
            </div>
          )}
        {['saas-revenue', 'members'].includes(name) && (
          <div className="field">
            <label htmlFor="plan-filter">Plan</label>
            <ReferenceSelect
              id="plan-filter"
              resource={admin ? 'saas-plans' : 'mess-plans'}
              value={extraFilters.planId ?? ''}
              optional
              onChange={(value) => {
                setExtraFilters((v) => ({ ...v, planId: value }));
                setPage(1);
              }}
            />
          </div>
        )}
        {name === 'saas-revenue' && (
          <>
            <div className="field">
              <label htmlFor="hotel-filter">Hotel</label>
              <ReferenceSelect
                id="hotel-filter"
                resource="hotels"
                value={extraFilters.hotelId ?? ''}
                optional
                onChange={(value) => {
                  setExtraFilters((v) => ({ ...v, hotelId: value }));
                  setPage(1);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="group-filter">Group by</label>
              <select
                id="group-filter"
                value={extraFilters.groupBy ?? 'records'}
                onChange={(e) => {
                  setExtraFilters((v) => ({ ...v, groupBy: e.target.value }));
                  setPage(1);
                }}
              >
                <option value="records">Invoices</option>
                <option value="plan">Plan-wise revenue</option>
              </select>
            </div>
          </>
        )}
        {name === 'members' && (
          <div className="field">
            <label htmlFor="status-filter">Membership status</label>
            <select
              id="status-filter"
              value={extraFilters.status ?? ''}
              onChange={(e) => {
                setExtraFilters((v) => ({ ...v, status: e.target.value }));
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {['active', 'expired', 'upcoming'].map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </div>
        )}
        {name === 'hotel-registrations' && (
          <>
            <div className="field">
              <label htmlFor="account-status">Account status</label>
              <select
                id="account-status"
                value={extraFilters.accountStatus ?? ''}
                onChange={(e) => {
                  setExtraFilters((v) => ({ ...v, accountStatus: e.target.value }));
                  setPage(1);
                }}
              >
                <option value="">All accounts</option>
                {['active', 'inactive', 'suspended'].map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="subscription-status">Subscription status</label>
              <select
                id="subscription-status"
                value={extraFilters.subscriptionStatus ?? ''}
                onChange={(e) => {
                  setExtraFilters((v) => ({ ...v, subscriptionStatus: e.target.value }));
                  setPage(1);
                }}
              >
                <option value="">All subscriptions</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </>
        )}
        {name === 'expenses' && (
          <div className="field">
            <label htmlFor="category-filter">Category</label>
            <ReferenceSelect
              id="category-filter"
              resource="expense-categories"
              value={extraFilters.categoryId ?? ''}
              optional
              onChange={(value) => {
                setExtraFilters((v) => ({ ...v, categoryId: value }));
                setPage(1);
              }}
            />
          </div>
        )}
        {!admin && name.startsWith('vendor-') && (
          <div className="field">
            <label htmlFor="vendor-filter">Vendor</label>
            <ReferenceSelect
              resource="vendors"
              id="vendor-filter"
              value={vendorId}
              optional
              onChange={(v) => {
                setVendor(v);
                setPage(1);
              }}
            />
          </div>
        )}
        {['mess-collection', 'vendor-payments', 'expenses'].includes(name) && (
          <div className="field">
            <label htmlFor="method-filter">Payment method</label>
            <select
              id="method-filter"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All methods</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>
          </div>
        )}
      </div>
      {query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(data?.summary ?? data?.totals ?? {})
          .filter(([k, v]) => k !== '_id' && v !== 0)
          .map(([k, v]) => (
            <div className="card !p-4" key={k}>
              <p className="text-xs text-muted-foreground">{label(k)}</p>
              <p className="mt-2 text-xl font-semibold">{currency(v)}</p>
            </div>
          ))}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {data?.from} — {data?.to} · {data?.basis}. Invoice-basis profit is not a service-day accrual
        calculation.
      </p>
      <DataTable
        items={data?.items ?? []}
        columns={columns}
        total={data?.total ?? 0}
        page={page}
        limit={20}
        onPage={setPage}
        loading={query.isPending}
      />
    </>
  );
}
