import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

// @ts-expect-error - Prisma client event types
prisma.$on('error', (e: { message: string }) => {
  logger.error({ err: e }, 'Prisma error');
});

// @ts-expect-error - Prisma client event types
prisma.$on('warn', (e: { message: string }) => {
  logger.warn({ warning: e }, 'Prisma warning');
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
