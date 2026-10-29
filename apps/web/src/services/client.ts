import axios, { AxiosError } from 'axios';
import type { ApiResponse, SessionUser } from '@annapurna/types';
import { appConfig } from '../config/app.config';
import { useSession } from '../stores/session';
import { queryClient } from '../config/query.config';
export const client = axios.create({
  baseURL: appConfig.apiUrl,
  timeout: appConfig.timeout,
  withCredentials: true,
});
client.interceptors.request.use((config) => {
  const token = useSession.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
let refreshing: Promise<void> | null = null;
export async function restoreSession() {
  if (!refreshing)
    refreshing = axios
      .post<ApiResponse<{ user: SessionUser; accessToken: string }>>(
        `${appConfig.apiUrl}/auth/refresh`,
        {},
        { withCredentials: true, timeout: appConfig.timeout },
      )
      .then((r) => {
        if (useSession.getState().user?.id !== r.data.data.user.id) queryClient.clear();
        useSession.getState().set(r.data.data.user, r.data.data.accessToken);
      })
      .catch(() => {
        queryClient.clear();
        useSession.getState().set(null, null);
      })
      .finally(() => {
        refreshing = null;
        useSession.getState().markReady();
      });
  await refreshing;
}
client.interceptors.response.use(
  (r) => r,
  async (
    error: AxiosError<{
      error?: { message: string; details?: { path: string[]; message: string }[] };
    }>,
  ) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original.url?.startsWith('/auth/') &&
      !(original as typeof original & { retried?: boolean }).retried
    ) {
      (original as typeof original & { retried?: boolean }).retried = true;
      await restoreSession();
      if (useSession.getState().token) return client(original);
    }
    const details = error.response?.data?.error?.details
      ?.map((d) => `${d.path.join('.')}: ${d.message}`)
      .join('; ');
    return Promise.reject(
      new Error(
        details || error.response?.data?.error?.message || error.message || 'Request failed',
      ),
    );
  },
);
