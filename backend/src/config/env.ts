import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from backend directory or project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  BACKEND_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Database & Cache
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),

  // Auth
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  GOOGLE_CLIENT_ID: z.string().default('mock-google-client-id'),
  GOOGLE_CLIENT_SECRET: z.string().default('mock-google-client-secret'),

  // Slack
  SLACK_CLIENT_ID: z.string().default('mock-slack-client-id'),
  SLACK_CLIENT_SECRET: z.string().default('mock-slack-client-secret'),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:4000/api/slack/callback'),

  // Queue & Worker Configuration
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().positive().default(200),
  ETHEREAL_SENDER_COUNT: z.coerce.number().int().positive().default(3),
  QUEUE_NAME: z.string().default('email-queue'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
