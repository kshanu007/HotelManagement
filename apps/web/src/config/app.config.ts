export const appConfig = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
  timeout: 20_000,
  paths: { login: '/login', dashboard: '/dashboard', reports: '/reports', settings: '/settings' },
  featureFlags: { exports: true },
  dateFormat: 'dd MMM yyyy',
};
