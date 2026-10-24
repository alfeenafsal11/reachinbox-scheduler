// ─── Domain Types ────────────────────────────────────────────────────────────

export type EmailStatus = 'scheduled' | 'delayed' | 'processing' | 'sent' | 'failed';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Sender {
  id: string;
  email: string;
  name: string;
  host: string;
  port: number;
}

export interface Campaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
  totalCount: number;
  createdAt: string;
}

export interface Email {
  id: string;
  userId: string;
  campaignId: string;
  senderId: string;
  toEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  attempts: number;
  errorMessage: string | null;
  previewUrl?: string | null;
  createdAt: string;
  sender?: { email: string };
  campaign?: { id: string; subject: string };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── API Payloads ────────────────────────────────────────────────────────────

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipients: string[];
  startAt: string;   // ISO string
  delayMs: number;
  hourlyLimit: number;
}

export interface SearchEmailsParams {
  q?: string;
  status?: EmailStatus;
  page?: number;
  pageSize?: number;
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
