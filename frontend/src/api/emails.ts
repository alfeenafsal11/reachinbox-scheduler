import { apiClient } from './client';
import type { Email, PaginatedResponse, ScheduleEmailPayload, SearchEmailsParams } from '../types';

export const emailsApi = {
  schedule: (payload: ScheduleEmailPayload) =>
    apiClient.post<{ campaignId: string; scheduled: number }>('/api/emails/schedule', payload),

  getScheduled: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<Email>>(
      `/api/emails/scheduled?page=${page}&pageSize=${pageSize}`
    ),

  getSent: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<Email>>(`/api/emails/sent?page=${page}&pageSize=${pageSize}`),

  search: ({ q, status, page = 1, pageSize = 20 }: SearchEmailsParams) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    return apiClient.get<PaginatedResponse<Email>>(`/api/emails/search?${params}`);
  },
};
