import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Plus,
  Wallet,
  CalendarCheck,
  Utensils,
  Building2,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ROLES } from '@annapurna/constants';
import { resourcePath } from '../../config/mess.config';
import { keys } from '../../config/query.config';
import { resourceApi } from '../../services/resources';
import { useSession } from '../../stores/session';
import { currency, label, display } from '../../utils/format';
import { Button } from '../../components/ui/button';
import { Loading, ErrorState, Empty } from '../../components/feedback/QueryState';
export default function DashboardPage() {
  const user = useSession((s) => s.user);
  const admin = user?.role === ROLES.admin;
  const query = useQuery({
    queryKey: keys.dashboard,
    queryFn: ({ signal }) => resourceApi.dashboard(signal),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const main = admin
    ? ['Registered hotels', 'Active hotels', 'collectionsPaise', 'outstandingPaise']
    : ['Mess customers', 'Active members', 'messCollectionsPaise', 'customerOutstandingPaise'];
  const secondary = Object.entries(data.kpis).filter(([k]) => !main.includes(k));
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">
            {admin ? 'Platform overview' : 'A little clarity for your day'} · {data.today}
          </p>
          <h1 className="page-title">Welcome back, {user?.name.split(' ')[0]}.</h1>
          <p className="mt-2 text-muted-foreground">
            {admin
              ? 'Your hospitality platform, at a glance.'
              : 'Good food. Happy members. A well-run business.'}
          </p>
        </div>
        <Button asChild>
          <Link to={admin ? '/hotels' : resourcePath('mess-payments')}>
            <Plus />
            {admin ? 'Add hotel' : 'Record collection'}
          </Link>
        </Button>
      </div>
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {main.map((k, i) => (
          <div key={k} className="card">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{label(k)}</p>
              <span className="rounded-lg bg-secondary p-2 text-primary">
                {i < 2 ? <Utensils size={17} /> : <Wallet size={17} />}
              </span>
            </div>
            <p className="text-3xl font-semibold tracking-tight">
              {k.endsWith('Paise') ? currency(data.kpis[k]) : (data.kpis[k] ?? 0)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {k.endsWith('OutstandingPaise') || k === 'outstandingPaise'
                ? 'All-time open balance'
                : i < 2
                  ? 'Current workspace'
                  : 'This month'}
            </p>
          </div>
        ))}
      </div>
      <div className="mb-7 grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <section className="card">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold">Collection rhythm</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Mess collections · this month · INR
              </p>
            </div>
            <span className="badge">This month</span>
          </div>
          {data.chart.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chart}>
                  <defs>
                    <linearGradient id="collections" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="_id"
                    tickFormatter={(v) => String(v).slice(8)}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${Number(v) / 100}`}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => currency(v)}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 10,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="collectionsPaise"
                    name="Collected"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#collections)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty message="Your collection history will appear here." />
          )}
        </section>
        <section className="card relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-secondary" />
          <div className="relative">
            <p className="eyebrow mb-2">Daily essentials</p>
            <h2 className="mb-5 font-serif text-2xl">
              A smoother service
              <br />
              starts here.
            </h2>
            {(admin
              ? [
                  { to: 'hotels', icon: Building2, text: 'Manage hotels' },
                  { to: 'saas-subscriptions', icon: CalendarCheck, text: 'Renew a subscription' },
                  { to: 'reports', icon: ArrowUpRight, text: 'Review platform reports' },
                ]
              : [
                  { to: 'attendance', icon: CalendarCheck, text: 'Mark meal attendance' },
                  { to: 'customers', icon: Plus, text: 'Welcome a new customer' },
                  { to: 'sales', icon: Wallet, text: 'Record today’s sales' },
                ]
            ).map((action) => (
              <Link
                key={action.to}
                to={resourcePath(action.to)}
                className="mb-2 flex items-center gap-3 rounded-lg border bg-card p-3 text-sm hover:bg-muted"
              >
                <action.icon size={17} className="text-primary" />
                <span className="flex-1">{action.text}</span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {secondary.map(([k, v]) => (
          <div key={k} className="card !p-4">
            <p className="text-xs text-muted-foreground">{label(k)}</p>
            <p className="mt-2 text-lg font-semibold">{k.endsWith('Paise') ? currency(v) : v}</p>
          </div>
        ))}
      </div>
      <section className="card">
        <h2 className="mb-4 font-semibold">
          {admin ? 'Recent registrations' : 'Recent collections'}
        </h2>
        {data.recent.length ? (
          <div className="divide-y">
            {data.recent.map((row) => (
              <div key={row._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{String(row.name ?? row.receiptNo)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {display(row.createdAt, 'createdAt')}
                  </p>
                </div>
                <span className="badge">
                  {row.amountPaise ? currency(row.amountPaise) : String(row.status ?? 'active')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty message="Nothing here yet. Your recent activity will appear here." />
        )}
      </section>
    </>
  );
}
