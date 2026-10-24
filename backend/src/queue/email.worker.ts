import { Worker, Job, DelayedError } from 'bullmq';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { createRedisClient, redis } from '../config/redis';
import { prisma } from '../config/prisma';
import { rateLimiter } from './rateLimiter';
import { senderService } from '../modules/senders/sender.service';
import { indexerService } from '../modules/search/indexer';
import { slackNotifier } from '../modules/slack/notifier';
import { EmailJobData } from './email.queue';
import { Email, EmailStatus } from '@prisma/client';

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    env.QUEUE_NAME,
    async (job: Job<EmailJobData>, token?: string) => {
      const { emailId } = job.data;

      // 1. Idempotency guard: Atomic claim in Postgres
      const claimedRows = await prisma.$queryRaw<Email[]>`
        UPDATE "Email"
        SET status = 'processing'::"EmailStatus", attempts = attempts + 1
        WHERE id = ${emailId} AND status IN ('scheduled'::"EmailStatus", 'delayed'::"EmailStatus")
        RETURNING *;
      `;

      if (!claimedRows || claimedRows.length === 0) {
        logger.info({ emailId, jobId: job.id }, 'Email already processed or claimed by another worker');
        return;
      }

      const email = claimedRows[0];

      // Load full email with relations
      const fullEmail = await prisma.email.findUnique({
        where: { id: email.id },
        include: { sender: true, campaign: true },
      });

      if (!fullEmail) {
        logger.error({ emailId }, 'Email record disappeared after claim');
        return;
      }

      try {
        // 2. Reserve Rate-Limit Slot across hourly windows
        const effectiveLimit = Math.min(
          fullEmail.campaign.hourlyLimit,
          fullEmail.sender.hourlyLimit ?? Infinity,
          env.MAX_EMAILS_PER_HOUR_PER_SENDER
        );

        const slot = await rateLimiter.reserveSlot(fullEmail.senderId, effectiveLimit);

        if (slot.windowOffset > 0 || slot.windowOffset === -1) {
          logger.info(
            {
              emailId,
              senderId: fullEmail.senderId,
              windowOffset: slot.windowOffset,
              runAt: new Date(slot.runAt).toISOString(),
            },
            'Hourly rate limit hit. Delaying email to next window.'
          );

          await prisma.email.update({
            where: { id: fullEmail.id },
            data: {
              status: EmailStatus.delayed,
              scheduledAt: new Date(slot.runAt),
            },
          });

          await indexerService.updateEmailStatus(fullEmail.id, {
            status: EmailStatus.delayed,
            scheduledAt: new Date(slot.runAt),
          });

          const delayedCount = await prisma.email.count({
            where: { senderId: fullEmail.senderId, status: EmailStatus.delayed },
          });

          await slackNotifier.notifyRateLimitHit({
            userId: fullEmail.userId,
            senderId: fullEmail.senderId,
            senderEmail: fullEmail.sender.email,
            hourlyLimit: effectiveLimit,
            delayedCount: Math.max(delayedCount, 1),
            nextWindowStart: slot.windowStart,
          });

          if (!token) {
            throw new Error('Worker token is missing for moveToDelayed');
          }

          await job.moveToDelayed(slot.runAt, token);
          throw new DelayedError();
        }

        // 3. Per-sender minimum gap in Redis
        // BullMQ limiter handles global throttle; Redis gap guarantees spacing per sender
        const gapKey = `gap:${fullEmail.senderId}`;
        const acquired = await redis.set(
          gapKey,
          '1',
          'PX',
          env.MIN_DELAY_BETWEEN_EMAILS_MS,
          'NX'
        );

        if (!acquired) {
          const pttl = await redis.pttl(gapKey);
          const retryAt = Date.now() + Math.max(pttl, 50);

          logger.info(
            { emailId, senderId: fullEmail.senderId, retryInMs: Math.max(pttl, 50) },
            'Per-sender gap active. Delaying briefly...'
          );

          await prisma.email.update({
            where: { id: fullEmail.id },
            data: { status: EmailStatus.scheduled },
          });

          if (!token) {
            throw new Error('Worker token is missing for moveToDelayed');
          }

          await job.moveToDelayed(retryAt, token);
          throw new DelayedError();
        }

        // 4. Send via cached Nodemailer transporter with deterministic Message-ID
        const transporter = await senderService.getTransporter(fullEmail.senderId);
        const deterministicMessageId = `<${fullEmail.id}@reachinbox.local>`;

        const info = await transporter.sendMail({
          from: `"ReachInbox" <${fullEmail.sender.email}>`,
          to: fullEmail.toEmail,
          subject: fullEmail.subject,
          text: fullEmail.body,
          html: `<div style="font-family: sans-serif; line-height: 1.5;">${fullEmail.body.replace(
            /\n/g,
            '<br/>'
          )}</div>`,
          messageId: deterministicMessageId,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);

        // 5. Success
        await prisma.email.update({
          where: { id: fullEmail.id },
          data: {
            status: EmailStatus.sent,
            sentAt: new Date(),
            messageId: info.messageId || deterministicMessageId,
            previewUrl: previewUrl ? String(previewUrl) : null,
          },
        });

        await indexerService.updateEmailStatus(fullEmail.id, {
          status: EmailStatus.sent,
          sentAt: new Date(),
        });

        logger.info(
          {
            emailId: fullEmail.id,
            to: fullEmail.toEmail,
            previewUrl,
          },
          'Email sent successfully'
        );
      } catch (err) {
        if (err instanceof DelayedError) {
          throw err;
        }

        const errorMessage = (err as Error).message || 'Unknown send error';
        logger.error({ err, emailId: fullEmail.id }, 'Error during email dispatch');

        const maxAttempts = job.opts.attempts || 3;
        const willRetry = job.attemptsMade < maxAttempts;

        if (willRetry) {
          await prisma.email.update({
            where: { id: fullEmail.id },
            data: { status: EmailStatus.scheduled },
          });
        } else {
          await prisma.email.update({
            where: { id: fullEmail.id },
            data: {
              status: EmailStatus.failed,
              error: errorMessage,
            },
          });

          await indexerService.updateEmailStatus(fullEmail.id, {
            status: EmailStatus.failed,
            error: errorMessage,
          });
        }

        throw err;
      }
    },
    {
      connection: createRedisClient('worker'),
      concurrency: env.WORKER_CONCURRENCY,
      limiter: {
        max: 1,
        duration: env.MIN_DELAY_BETWEEN_EMAILS_MS,
      },
    }
  );

  worker.on('failed', (job, err) => {
    if (!(err instanceof DelayedError)) {
      logger.error({ jobId: job?.id, err: err.message }, 'Job failed');
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker internal error');
  });

  return worker;
}
