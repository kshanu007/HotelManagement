import { QueryClient } from '@tanstack/react-query';
import { QUERY } from '@annapurna/constants';
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: QUERY.staleTime, retry: QUERY.retry, refetchOnWindowFocus: false },
  },
});
export const keys = {
  all: ['workspace'] as const,
  list: (resource: string, params: unknown) => ['workspace', resource, params] as const,
  detail: (resource: string, id: string) => ['workspace', resource, id] as const,
  dashboard: ['workspace', 'dashboard'] as const,
  settings: ['workspace', 'settings'] as const,
};
