import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { schemas, customerEnrollmentSchema } from '@annapurna/validation';
import type { RecordData } from '@annapurna/types';
import { Plus, Printer, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { resourceConfig } from '../../config/resources.config';
import { keys, queryClient } from '../../config/query.config';
import { resourceApi } from '../../services/resources';
import { DataTable } from '../../components/data-display/DataTable';
import { RecordForm } from '../../components/forms/RecordForm';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { ErrorState, Loading } from '../../components/feedback/QueryState';
import { display, label, currency } from '../../utils/format';
import { Receipt } from '../../components/data-display/Receipt';
import { canAccessResource } from '../../config/permissions.config';
import { messItem, resourcePath } from '../../config/mess.config';
import { CustomerSummary } from '../mess/CustomerSummary';
import { CustomerContext } from '../mess/CustomerContext';
import { EnrollmentPreview, LeavePreview } from '../mess/FormPreviews';
import { useSession } from '../../stores/session';
export default function ResourcePage({ embedded = false }: { embedded?: boolean }) {
  const { resource = 'customers' } = useParams();
  const [url, setUrl] = useSearchParams();
  const context = url.toString();
  function closeForm() {
    setModal(null);
    setUrl(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('action');
        return next;
      },
      { replace: true },
    );
  }
  const config = resourceConfig[resource];
  const role = useSession((s) => s.user?.role);
  const allowed = canAccessResource(role, resource);
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [debounced, setDebounced] = useState(''),
    [status, setStatus] = useState(''),
    [sort, setSort] = useState('createdAt'),
    [order, setOrder] = useState('desc');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null),
    [selected, setSelected] = useState<RecordData | null>(null);
  const key = useRef(crypto.randomUUID());
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    key.current = crypto.randomUUID();
    setPage(1);
    setSearch('');
    setStatus('');
    setModal(new URLSearchParams(context).get('action') === 'create' ? 'add' : null);
    setSelected(null);
  }, [resource, context]);
  const historyFilters: Record<string, string> = {};
  for (const key of ['customerId', 'vendorId', 'hotelId', 'partyId', 'subscriptionId']) {
    const value = url.get(key);
    if (value) {
      const mapped =
        ['customerId', 'vendorId', 'hotelId'].includes(key) &&
        (resource.endsWith('-payments') ||
          resource.endsWith('-refunds') ||
          resource.endsWith('-invoices'))
          ? 'partyId'
          : key;
      historyFilters[mapped] = value;
    }
  }
  const params = {
    page,
    limit: 20,
    q: debounced,
    ...(status ? { status } : {}),
    sort,
    order,
    ...historyFilters,
  };
  const query = useQuery({
    queryKey: keys.list(resource, params),
    queryFn: ({ signal }) => resourceApi.list(resource, params, signal),
    enabled: !!config && allowed,
  });
  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      modal === 'edit' && selected
        ? resourceApi.update(resource, selected._id, values)
        : resourceApi.create(
            resource === 'customers' ? 'customers/enroll' : resource,
            values,
            key.current,
          ),
    onSuccess: () => {
      toast.success('Record saved');
      closeForm();
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!config) return <ErrorState error={new Error('Page not found')} />;
  if (!allowed)
    return <ErrorState error={new Error('This page is not available for your account')} />;
  let fields = config.fields;
  if (modal === 'add' && resource === 'customers')
    fields = [
      ...fields.filter((field) => field.key !== 'status'),
      { key: 'planId', label: 'Meal plan', ref: 'mess-plans' },
      { key: 'startDate', type: 'date' },
    ];
  if (modal === 'edit' && resource === 'hotels')
    fields = fields.filter((f) => !f.key.startsWith('owner'));
  const initial =
    modal === 'edit' && selected
      ? Object.fromEntries(fields.map((f) => [f.key, selected[f.key]]))
      : Object.fromEntries(
          fields
            .filter(
              (field) =>
                ['customerId', 'vendorId', 'hotelId', 'subscriptionId', 'startDate'].includes(
                  field.key,
                ) && url.has(field.key),
            )
            .map((field) => [field.key, url.get(field.key)]),
        );
  const schema =
    modal === 'edit' && resource === 'hotels'
      ? z.object({
          name: z.string().min(1),
          phone: z.string(),
          email: z.string().email().or(z.literal('')),
          address: z.string(),
          status: z.enum(['active', 'inactive', 'suspended']),
          graceDays: z.number().int().min(0).max(30),
        })
      : modal === 'add' && resource === 'customers'
        ? customerEnrollmentSchema
        : schemas[resource as keyof typeof schemas];
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          {embedded ? (
            <h2 className="text-xl font-semibold">{messItem(resource)?.label ?? config.title}</h2>
          ) : (
            <>
              <p className="eyebrow mb-2">Your workspace / {config.title}</p>
              <h1 className="page-title">{config.title}</h1>
              <p className="mt-2 text-muted-foreground">{config.description}</p>
            </>
          )}
        </div>
        {!config.readOnly && (
          <Button
            onClick={() => {
              key.current = crypto.randomUUID();
              setModal('add');
            }}
          >
            <Plus />{' '}
            {embedded
              ? messItem(resource)?.action
              : `Add ${resource === 'customers' ? 'customer' : 'record'}`}
          </Button>
        )}
      </div>
      {query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
      {embedded && url.get('customerId') && (
        <CustomerContext
          id={url.get('customerId')!}
          onClear={() => setUrl(new URLSearchParams(), { replace: true })}
        />
      )}
      {config.fields.find((f) => f.key === 'status' && f.type === 'select') && (
        <label className="mb-4 flex max-w-xs items-center gap-3 text-xs">
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {config.fields
              .find((f) => f.key === 'status')
              ?.options?.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
          </select>
        </label>
      )}
      <DataTable
        items={query.data?.items ?? []}
        columns={config.columns}
        page={page}
        total={query.data?.total ?? 0}
        limit={20}
        onPage={setPage}
        search={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        loading={query.isPending}
        onView={setSelected}
        onSort={(c) => {
          if (['createdAt', 'name', 'date', 'startDate', 'endDate', 'amountPaise'].includes(c)) {
            setSort(c);
            setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
          }
        }}
      />
      {modal && schema && (
        <Modal title={`${modal === 'edit' ? 'Edit' : 'Add'} · ${config.title}`} onClose={closeForm}>
          {modal === 'edit' && ['expenses', 'sales', 'purchases'].includes(resource) && (
            <p className="mb-4 text-sm text-muted-foreground">
              This saves a replacement and preserves the original. Enter your correction reason in
              Note.
            </p>
          )}
          <RecordForm
            key={`${resource}-${modal}-${selected?._id ?? ''}`}
            fields={fields}
            schema={schema}
            initial={initial}
            pending={mutation.isPending}
            preview={
              resource === 'customers' && modal === 'add'
                ? (values) => <EnrollmentPreview values={values} />
                : resource === 'leaves'
                  ? (values) => <LeavePreview values={values} />
                  : undefined
            }
            onSubmit={async (values) => {
              if (
                modal === 'edit' &&
                ['inactive', 'suspended'].includes(String(values.status)) &&
                values.status !== selected?.status &&
                !window.confirm(`Change this account to ${values.status}?`)
              )
                return;
              if (
                resource.endsWith('-refunds') &&
                !window.confirm(`Record a refund of ${currency(values.amountPaise)}?`)
              )
                return;
              await mutation.mutateAsync(values).catch(() => undefined);
            }}
          />
        </Modal>
      )}
      {selected && !modal && (
        <RecordDetail
          resource={resource}
          row={selected}
          onClose={() => setSelected(null)}
          onEdit={
            config.editable
              ? (data) => {
                  setSelected(data);
                  setModal('edit');
                }
              : undefined
          }
        />
      )}
    </>
  );
}
function RecordDetail({
  resource,
  row,
  onClose,
  onEdit,
}: {
  resource: string;
  row: RecordData;
  onClose: () => void;
  onEdit?: (data: RecordData) => void;
}) {
  const query = useQuery({
    queryKey: keys.detail(resource, row._id),
    queryFn: () => resourceApi.detail(resource, row._id),
  });
  const isReceipt = resource.endsWith('-payments') || resource.endsWith('-refunds');
  const settings = useQuery({
    queryKey: keys.settings,
    queryFn: resourceApi.settings,
    enabled: isReceipt,
  });
  const cancel = useMutation({
    mutationFn: () => resourceApi.update(resource, row._id, { status: 'cancelled' }),
    onSuccess: () => {
      toast.success('Leave cancelled');
      void queryClient.invalidateQueries({ queryKey: keys.all });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const data = query.data ?? row;
  return (
    <Modal title={String(data.name ?? data.receiptNo ?? 'Record details')} onClose={onClose}>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : resource === 'customers' ? (
        <CustomerSummary customer={data} onClose={onClose} />
      ) : isReceipt ? (
        <Receipt record={data} settings={settings.data} />
      ) : (
        <dl className="grid gap-3">
          {Object.entries(data)
            .filter(([k]) => !['tenantId', '__v', 'deletedAt', 'displayLabels'].includes(k))
            .map(([k, v]) => (
              <div key={k} className="grid grid-cols-[140px_1fr] gap-3 border-b pb-2 text-sm">
                <dt className="text-muted-foreground">{label(k)}</dt>
                <dd className="break-all">{display(v, k)}</dd>
              </div>
            ))}
        </dl>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {onEdit && (
          <Button disabled={query.isPending || !!query.error} onClick={() => onEdit(data)}>
            <Pencil /> Edit
          </Button>
        )}
        {resource === 'leaves' && data.status !== 'cancelled' && (
          <Button
            variant="destructive"
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm('Cancel this leave? This action is recorded in the audit log.'))
                cancel.mutate();
            }}
          >
            Cancel leave
          </Button>
        )}
        {isReceipt && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print receipt
          </Button>
        )}
        {resource === 'vendors' && (
          <Button asChild variant="outline">
            <Link to={`/reports?vendorId=${row._id}`} onClick={onClose}>
              Vendor ledger
            </Link>
          </Button>
        )}
        {resource === 'vendors' &&
          ['purchases', 'vendor-payments', 'vendor-refunds'].map((r) => (
            <Button key={r} asChild variant="outline">
              <Link to={`${resourcePath(r)}?vendorId=${row._id}`} onClick={onClose}>
                {label(r)}
              </Link>
            </Button>
          ))}
        {resource === 'hotels' &&
          ['saas-subscriptions', 'saas-invoices', 'saas-payments', 'saas-refunds'].map((r) => (
            <Button key={r} asChild variant="outline">
              <Link to={`${resourcePath(r)}?hotelId=${row._id}`} onClick={onClose}>
                {label(r)}
              </Link>
            </Button>
          ))}
      </div>
    </Modal>
  );
}
