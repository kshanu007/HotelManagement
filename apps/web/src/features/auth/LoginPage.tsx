import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UtensilsCrossed, ArrowRight, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { loginSchema, password } from '@annapurna/validation';
import { toast } from 'sonner';
import { RecordForm } from '../../components/forms/RecordForm';
import { Button } from '../../components/ui/button';
import { authApi } from './api';
import { useSession } from '../../stores/session';
import { queryClient } from '../../config/query.config';
export default function LoginPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('token') ? 'reset' : 'login');
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3 text-xl font-semibold">
          <UtensilsCrossed /> Annapurna
          <span className="text-xs font-normal opacity-70">HOTEL & MESS</span>
        </div>
        <div className="relative z-10">
          <p className="mb-4 text-xs uppercase tracking-[.25em] opacity-70">
            More care. Less paperwork.
          </p>
          <h1 className="max-w-lg font-serif text-6xl leading-[1.12]">
            A well-run kitchen.
            <br />A little peace
            <br />
            of mind.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed opacity-75">
            Your members, meals and money — thoughtfully brought together in one calm workspace.
          </p>
          <div className="mt-10 flex items-center gap-2 text-sm opacity-75">
            <ShieldCheck size={18} /> Built for independent hospitality businesses.
          </div>
        </div>
        <p className="text-xs opacity-60">Made for the people who feed our communities.</p>
        <div className="absolute -bottom-44 -right-52 h-[550px] w-[550px] rounded-full border-[70px] border-primary-foreground/5" />
      </section>
      <section className="flex items-center justify-center p-7">
        <div className="w-full max-w-sm">
          <div className="mb-12 flex items-center gap-2 font-semibold text-primary lg:hidden">
            <UtensilsCrossed /> Annapurna
          </div>
          <p className="eyebrow mb-3">Your hospitality workspace</p>
          <h2 className="page-title">
            {mode === 'login'
              ? 'Welcome back.'
              : mode === 'forgot'
                ? 'Forgot your password?'
                : 'A fresh start.'}
          </h2>
          <p className="mb-8 mt-3 text-sm text-muted-foreground">
            {mode === 'login'
              ? 'Sign in to keep your day running smoothly.'
              : mode === 'forgot'
                ? 'Request a reset, then contact your platform administrator.'
                : 'Choose a strong new password for your account.'}
          </p>
          {mode === 'login' ? (
            <RecordForm
              submitLabel="Sign in"
              fields={[
                { key: 'email', type: 'email' },
                { key: 'password', type: 'password' },
              ]}
              schema={loginSchema}
              onSubmit={async (values) => {
                try {
                  const data = await authApi.login(values);
                  queryClient.clear();
                  useSession.getState().set(data.user, data.accessToken);
                  navigate('/dashboard');
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          ) : mode === 'forgot' ? (
            <RecordForm
              submitLabel="Request password reset"
              fields={[{ key: 'email', type: 'email' }]}
              schema={z.object({ email: z.string().email() })}
              onSubmit={async (values) => {
                try {
                  await authApi.forgot(String(values.email));
                  toast.success(
                    'If the account exists, contact your administrator for a reset link.',
                  );
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          ) : (
            <RecordForm
              submitLabel="Reset password"
              fields={[{ key: 'password', type: 'password' }]}
              schema={z.object({ password })}
              onSubmit={async (values) => {
                try {
                  await authApi.reset({ ...values, token: params.get('token') });
                  toast.success('Password reset. Sign in to continue.');
                  setMode('login');
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          )}
          <Button
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => setMode(mode === 'login' ? 'forgot' : 'login')}
          >
            {mode === 'login' ? 'Forgot password?' : 'Back to sign in'}
            <ArrowRight />
          </Button>
          <p className="mt-10 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
            For hotel owners and platform administrators. Your account determines your workspace.
          </p>
        </div>
      </section>
    </div>
  );
}
