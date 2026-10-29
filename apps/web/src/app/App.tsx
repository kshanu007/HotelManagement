import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from '../config/query.config';
import { useSession } from '../stores/session';
import { usePreferences } from '../stores/preferences';
import { restoreSession } from '../services/client';
import { messResources, resourcePath } from '../config/mess.config';
import { Loading } from '../components/feedback/QueryState';
import { ErrorBoundary } from './providers/ErrorBoundary';
const Shell = lazy(() => import('./layouts/AppShell'));
const Login = lazy(() => import('../features/auth/LoginPage'));
const Dashboard = lazy(() => import('../features/hotel-dashboard/DashboardPage'));
const Resource = lazy(() => import('../features/operations/ResourcePage'));
const Reports = lazy(() => import('../features/reports/ReportsPage'));
const Mess = lazy(() => import('../features/mess/MessWorkspace'));
const Settings = lazy(() => import('../features/settings/SettingsPage'));
function ResourceRoute() {
  const { resource = '' } = useParams();
  const location = useLocation();
  return messResources.includes(resource) ? (
    <Navigate to={`${resourcePath(resource)}${location.search}${location.hash}`} replace />
  ) : (
    <Resource />
  );
}
function Protected() {
  const user = useSession((s) => s.user);
  return user ? <Shell /> : <Navigate to="/login" replace />;
}
export default function App() {
  const ready = useSession((s) => s.ready),
    theme = usePreferences((s) => s.theme);
  useEffect(() => {
    void restoreSession();
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () =>
      document.documentElement.classList.toggle(
        'dark',
        theme === 'dark' || (theme === 'system' && media.matches),
      );
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [theme]);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            {!ready ? (
              <Loading />
            ) : (
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<Protected />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route
                    path="/mess"
                    element={<Navigate to={resourcePath('customers')} replace />}
                  />
                  <Route path="/mess/:resource" element={<Mess />} />
                  <Route path="/:resource" element={<ResourceRoute />} />
                </Route>
              </Routes>
            )}
          </Suspense>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
