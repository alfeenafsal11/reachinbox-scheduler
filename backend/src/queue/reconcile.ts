import { prisma } from '../config/prisma';
import { emailQueue } from './email.queue';
import { EmailStatus } from '@prisma/client';
import { logger } from '../config/logger';

export interface ReconcileResult {
  requeuedCount: number;
  staleResetCount: number;
  activeProcessingCount: number;
}

export async function reconcileQueue(): Promise<ReconcileResult> {
  logger.info('🔄 Running startup queue reconciliation...');

  let staleResetCount = 0;
  let requeuedCount = 0;
  let activeProcessingCount = 0;

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  // 1. Recover stale 'processing' emails that have no active worker job
  const processingEmails = await prisma.email.findMany({
    where: {
      status: EmailStatus.processing,
      createdAt: { lt: twoMinutesAgo },
    },
  });

  for (const email of processingEmails) {
    const job = await emailQueue.getJob(email.id);
    const state = job ? await job.getState() : null;

    if (!job || state !== 'active') {
      // Worker crashed or job was lost while processing; revert to scheduled
      await prisma.email.update({
        where: { id: email.id },
        data: { status: EmailStatus.scheduled },
      });
      staleResetCount++;
      logger.info({ emailId: email.id }, 'Reset stale processing email back to scheduled');
    } else {
      activeProcessingCount++;
    }
  }

  // 2. Find all pending emails (scheduled or delayed)
  const pendingEmails = await prisma.email.findMany({
    where: {
      status: { in: [EmailStatus.scheduled, EmailStatus.delayed] },
    },
  });

  const now = Date.now();

  for (const email of pendingEmails) {
    const job = await emailQueue.getJob(email.id);

    if (!job) {
      // Job is missing from Redis; re-add with jobId = email.id
      const delay = Math.max(0, email.scheduledAt.getTime() - now);

      await emailQueue.add(
        'send',
        { emailId: email.id },
        {
          jobId: email.id,
          delay,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 86400,
            count: 5000,
          },
          removeOnFail: false,
        }
      );

      requeuedCount++;
      logger.info(
        { emailId: email.id, delay, scheduledAt: email.scheduledAt.toISOString() },
        'Reconciled missing BullMQ job'
      );
    }
  }

  logger.info(
    {
      requeuedCount,
      staleResetCount,
      activeProcessingCount,
      totalPending: pendingEmails.length,
    },
    '✅ Queue reconciliation completed successfully'
  );

  return {
    requeuedCount,
    staleResetCount,
    activeProcessingCount,
  };
}
