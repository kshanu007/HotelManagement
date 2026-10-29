import type { ApiResponse, SessionUser } from '@annapurna/types';
import { client } from '../../services/client';
export const authApi = {
  login: async (data: unknown) =>
    (
      await client.post<ApiResponse<{ user: SessionUser; accessToken: string }>>(
        '/auth/login',
        data,
      )
    ).data.data,
  logout: () => client.post('/auth/logout'),
  forgot: (email: string) => client.post('/auth/forgot-password', { email }),
  reset: (data: unknown) => client.post('/auth/reset-password', data),
  change: (data: unknown) => client.post('/auth/change-password', data),
  revoke: () => client.post('/auth/revoke-sessions'),
};
