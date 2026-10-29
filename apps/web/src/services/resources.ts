import type { ApiResponse, Page, RecordData } from '@annapurna/types';
import { client } from './client';
export const resourceApi = {
  list: async (resource: string, params: Record<string, unknown>, signal?: AbortSignal) =>
    (await client.get<ApiResponse<Page<RecordData>>>(`/${resource}`, { params, signal })).data.data,
  detail: async (resource: string, id: string) =>
    (await client.get<ApiResponse<RecordData>>(`/${resource}/${id}`)).data.data,
  create: async (resource: string, data: unknown, key: string) =>
    (
      await client.post<ApiResponse<RecordData>>(`/${resource}`, data, {
        headers: { 'Idempotency-Key': key },
      })
    ).data.data,
  update: async (resource: string, id: string, data: unknown) =>
    (await client.put<ApiResponse<RecordData>>(`/${resource}/${id}`, data)).data.data,
  dashboard: async (signal?: AbortSignal) =>
    (await client.get<ApiResponse<DashboardData>>('/dashboard', { signal })).data.data,
  settings: async () => (await client.get<ApiResponse<RecordData>>('/settings')).data.data,
  subscriptionStatus: async () =>
    (
      await client.get<ApiResponse<{ subscription: RecordData | null; graceDays: number }>>(
        '/subscription-status',
      )
    ).data.data,
  saveSettings: async (data: unknown) => (await client.put('/settings', data)).data,
  printReport: async (name: string, params: Record<string, unknown>) => {
    const preview = window.open('', '_blank');
    if (!preview) throw new Error('Allow pop-ups to open the printable report');
    try {
      const response = await client.get(`/reports/${name}/export/pdf`, {
        params,
        responseType: 'blob',
        timeout: 120000,
      });
      const url = URL.createObjectURL(response.data);
      preview.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (error) {
      preview.close();
      throw error;
    }
  },
  report: async (name: string, params: Record<string, unknown>, signal?: AbortSignal) =>
    (await client.get<ApiResponse<ReportData>>(`/reports/${name}`, { params, signal })).data.data,
  export: async (name: string, format: string, params: Record<string, unknown>) => {
    const r = await client.get(`/reports/${name}/export/${format}`, {
      params,
      responseType: 'blob',
      timeout: 120000,
    });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
export interface DashboardData {
  today: string;
  kpis: Record<string, number>;
  daily?: Record<string, number>;
  recent: RecordData[];
  chart: { _id: string; collectionsPaise: number }[];
}
export interface ReportData extends Page<RecordData> {
  totals: Record<string, number>;
  summary?: Record<string, number>;
  from: string;
  to: string;
  basis: string;
}
