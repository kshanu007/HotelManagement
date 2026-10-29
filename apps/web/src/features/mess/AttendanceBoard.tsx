import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { schemas } from '@annapurna/validation';
import type { ApiResponse, Page } from '@annapurna/types';
import { toast } from 'sonner';
import { client } from '../../services/client';
import { resourceApi } from '../../services/resources';
import { keys, queryClient } from '../../config/query.config';
import { resourceConfig } from '../../config/resources.config';
import { today } from '../../utils/format';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { RecordForm } from '../../components/forms/RecordForm';
import { ErrorState, Loading } from '../../components/feedback/QueryState';
import { CustomerContext } from './CustomerContext';
import { LeavePreview } from './FormPreviews';

interface RosterRow {
  _id: string;
  name: string;
  customerCode: string;
  planName: string;
  status: string;
  attendanceId: string | null;
  note: string;
  leaveDays: number;
  leaveMeals: number;
}

export default function AttendanceBoard() {
  const [url, setUrl] = useSearchParams();
  const customerId = url.get('customerId');
  const [date, setDate] = useState(today()),
    [meal, setMeal] = useState('lunch');
  const [search, setSearch] = useState(''),
    [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [leaveCustomer, setLeaveCustomer] = useState<string | null>(null);
  const leaveKey = useRef(crypto.randomUUID());
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const params = { date, meal, q: debounced, page, ...(customerId ? { customerId } : {}) };
  const query = useQuery({
    queryKey: keys.list('attendance-roster', params),
    enabled: !!date,
    queryFn: async ({ signal }) =>
      (
        await client.get<ApiResponse<Page<RosterRow> & { month: string }>>(
          '/mess/attendance-roster',
          { params, signal },
        )
      ).data.data,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: keys.all });
  };
  const mark = useMutation({
    mutationFn: ({ row, status }: { row: RosterRow; status: string }) => {
      const values = { customerId: row._id, date, meal, status, note: row.note };
      return row.attendanceId
        ? resourceApi.update('attendance', row.attendanceId, values)
        : resourceApi.create('attendance', values, crypto.randomUUID());
    },
    onSuccess: () => {
      toast.success('Attendance saved');
      refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      refresh();
    },
  });
  const leave = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      resourceApi.create('leaves', values, leaveKey.current),
    onSuccess: () => {
      setLeaveCustomer(null);
      toast.success('Leave saved');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function openLeave(id = '') {
    leaveKey.current = crypto.randomUUID();
    setLeaveCustomer(id);
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Daily attendance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a date and meal, then mark each customer. Approved leave appears automatically.
          </p>
        </div>
        <Button onClick={() => openLeave(customerId ?? '')}>Add leave</Button>
      </div>
      {customerId && (
        <CustomerContext
          id={customerId}
          onClear={() => {
            setPage(1);
            setUrl(new URLSearchParams(), { replace: true });
          }}
        />
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <label className="field">
          Attendance date
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field">
          Meal
          <select
            value={meal}
            onChange={(event) => {
              setMeal(event.target.value);
              setPage(1);
            }}
          >
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </label>
        <label className="field">
          Find customer
          <input
            value={search}
            placeholder="Name, customer ID or phone"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
      {query.isPending && date && <Loading />}
      {query.data && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {query.data.total} eligible customers. Leave totals below are for {query.data.month},
            across lunch and dinner.
          </p>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="block w-full text-left text-sm md:table">
              <thead className="hidden bg-muted md:table-header-group">
                <tr>
                  {['Customer', 'Status', 'Leave this month', 'Mark attendance'].map((heading) => (
                    <th key={heading} className="p-4">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {query.data.items.map((row) => (
                  <tr key={row._id} className="grid gap-3 border-t p-4 md:table-row md:p-0">
                    <td className="block md:table-cell md:p-4">
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.customerCode} / {row.planName}
                      </p>
                    </td>
                    <td className="block capitalize md:table-cell md:p-4">
                      <span className="mr-2 text-xs text-muted-foreground md:hidden">Status:</span>
                      {row.status === 'leave' ? 'On leave' : row.status}
                    </td>
                    <td className="block md:table-cell md:whitespace-nowrap md:p-4">
                      <span className="mr-2 text-xs text-muted-foreground md:hidden">
                        Leave this month:
                      </span>
                      {row.leaveDays} days / {row.leaveMeals} meals
                    </td>
                    <td className="block md:table-cell md:p-4">
                      <div className="flex flex-wrap gap-2">
                        {['present', 'absent'].map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={row.status === status ? 'default' : 'outline'}
                            aria-pressed={row.status === status}
                            disabled={mark.isPending || query.isFetching || row.status === 'leave'}
                            onClick={() => mark.mutate({ row, status })}
                          >
                            {status === 'present' ? 'Present' : 'Absent'}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={row.status === 'leave'}
                          onClick={() => openLeave(row._id)}
                        >
                          Leave
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!query.data.items.length && (
              <div className="p-6 text-sm">
                <p>
                  No active membership covers this date and meal. Check the selected date or meal,
                  or assign a membership from Customers.
                </p>
                <Link to="/mess/customers" className="mt-2 inline-block text-primary underline">
                  Open customers
                </Link>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              disabled={page === 1 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">Page {page}</span>
            <Button
              variant="outline"
              disabled={page * 20 >= query.data.total || query.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        To add leave after marking Present, first change the attendance to Absent. Manage or cancel
        leave in the Leave tab. Leave totals count days and meals, without automatically changing
        bills or membership dates.
      </p>
      {leaveCustomer !== null && (
        <Modal title="Add leave" onClose={() => setLeaveCustomer(null)}>
          <RecordForm
            fields={resourceConfig.leaves.fields}
            schema={schemas.leaves}
            initial={{ customerId: leaveCustomer, startDate: date, endDate: date, meal }}
            preview={(values) => <LeavePreview values={values} />}
            pending={leave.isPending}
            onSubmit={async (values) => {
              await leave.mutateAsync(values).catch(() => undefined);
            }}
          />
        </Modal>
      )}
    </>
  );
}
