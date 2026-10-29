export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'hotel_owner';
  tenantId?: string;
}
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export type RecordData = { _id: string; createdAt: string; [key: string]: unknown };
