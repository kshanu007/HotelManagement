import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { settingsSchema, password } from '@annapurna/validation';
import { ROLES } from '@annapurna/constants';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../stores/session';
import { usePreferences } from '../../stores/preferences';
import { keys, queryClient } from '../../config/query.config';
import { resourceApi } from '../../services/resources';
import { authApi } from '../auth/api';
import { RecordForm } from '../../components/forms/RecordForm';
import { Button } from '../../components/ui/button';
import { Loading, ErrorState } from '../../components/feedback/QueryState';
import { display } from '../../utils/format';
export default function SettingsPage() {
  const admin = useSession((s) => s.user?.role === ROLES.admin);
  const query = useQuery({ queryKey: keys.settings, queryFn: resourceApi.settings });
  const subscription = useQuery({
    queryKey: keys.list('subscription-status', {}),
    queryFn: resourceApi.subscriptionStatus,
    enabled: !admin,
  });
  const theme = usePreferences((s) => s.theme),
    setTheme = usePreferences((s) => s.setTheme);
  const navigate = useNavigate();
  async function revoke() {
    if (!window.confirm('Revoke every session, including this one?')) return;
    try {
      await authApi.revoke();
      useSession.getState().set(null, null);
      queryClient.clear();
      navigate('/login');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  const data = query.data;
  return (
    <>
      <div className="mb-7">
        <p className="eyebrow mb-2">Make yourself at home</p>
        <h1 className="page-title">Workspace settings</h1>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-5 font-semibold">{admin ? 'Platform profile' : 'Hotel profile'}</h2>
          <RecordForm
            schema={
              admin
                ? z.object({ name: z.string().min(1), supportEmail: z.string().email() })
                : settingsSchema
            }
            fields={
              admin
                ? [{ key: 'name' }, { key: 'supportEmail', type: 'email' }]
                : [
                    { key: 'name' },
                    { key: 'address', type: 'textarea' },
                    { key: 'phone' },
                    { key: 'email', type: 'email', optional: true },
                    { key: 'logo', label: 'Logo URL', optional: true },
                    { key: 'lunchTime' },
                    { key: 'dinnerTime' },
                    { key: 'timezone' },
                    { key: 'paymentMethods', type: 'checks', options: ['cash', 'upi'] },
                  ]
            }
            initial={
              admin
                ? { name: data.name ?? 'Annapurna', supportEmail: data.supportEmail ?? '' }
                : {
                    ...Object.fromEntries(
                      [
                        'name',
                        'address',
                        'phone',
                        'email',
                        'logo',
                        'lunchTime',
                        'dinnerTime',
                        'timezone',
                      ].map((k) => [k, data[k]]),
                    ),
                    paymentMethods: data.paymentMethods ?? ['cash', 'upi'],
                  }
            }
            onSubmit={async (values) => {
              try {
                await resourceApi.saveSettings(values);
                toast.success('Settings saved');
                void queryClient.invalidateQueries({ queryKey: keys.settings });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          />
        </section>
        <div className="space-y-5">
          {!admin && (
            <section className="card">
              <h2 className="mb-4 font-semibold">Platform subscription</h2>
              {subscription.isPending ? (
                <Loading />
              ) : subscription.error ? (
                <ErrorState error={subscription.error} />
              ) : subscription.data?.subscription ? (
                <>
                  <p className="font-medium">{String(subscription.data.subscription.planName)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {display(subscription.data.subscription.startDate)} to{' '}
                    {display(subscription.data.subscription.endDate)} ·{' '}
                    {subscription.data.graceDays} grace days
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  No platform plan assigned. Contact your administrator.
                </p>
              )}
            </section>
          )}
          <section className="card">
            <h2 className="mb-3 font-semibold">Appearance</h2>
            <label className="field">
              Theme
              <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </section>
          <section className="card">
            <h2 className="mb-5 font-semibold">Change password</h2>
            <RecordForm
              fields={[
                { key: 'currentPassword', type: 'password' },
                { key: 'password', label: 'New password', type: 'password' },
              ]}
              schema={z.object({ currentPassword: z.string().min(1), password })}
              onSubmit={async (values) => {
                try {
                  await authApi.change(values);
                  toast.success('Password changed. Please sign in again.');
                  useSession.getState().set(null, null);
                  queryClient.clear();
                  navigate('/login');
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              At least 12 characters with uppercase, lowercase and a number.
            </p>
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">Sessions</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Sign out every device connected to your account.
            </p>
            <Button variant="destructive" onClick={() => void revoke()}>
              Revoke all sessions
            </Button>
          </section>
        </div>
      </div>
    </>
  );
}
