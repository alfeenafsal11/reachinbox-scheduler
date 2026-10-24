import { apiClient } from './client';
import type { User } from '../types';

export const authApi = {
  me: () => apiClient.get<User>('/auth/me'),
  logout: () => apiClient.post<{ message: string }>('/auth/logout'),
  devLogin: (email: string, name: string) =>
    apiClient.post<{ token: string; user: User }>('/auth/dev-login', { email, name }),
};
