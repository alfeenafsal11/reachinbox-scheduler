import { z } from 'zod';

export const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z
    .array(z.string().trim().email('Invalid email address'))
    .min(1, 'At least one recipient is required'),
  startAt: z.string().datetime().refine((val) => {
    const time = new Date(val).getTime();
    return time >= Date.now() - 60000;
  }, 'startAt cannot be in the past by more than 1 minute'),
  delayMs: z.coerce.number().int().min(0, 'delayMs must be greater than or equal to 0'),
  hourlyLimit: z.coerce.number().int().min(1, 'hourlyLimit must be at least 1'),
});

export const listEmailsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;
export type ListEmailsQuery = z.infer<typeof listEmailsQuerySchema>;
