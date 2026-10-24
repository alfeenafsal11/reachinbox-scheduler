import { prisma } from '../../config/prisma';
import { emailQueue } from '../../queue/email.queue';
import { senderService } from '../senders/sender.service';
import { indexerService, EmailDoc } from '../search/indexer';
import { ScheduleEmailInput } from './schemas';
import { EmailStatus } from '@prisma/client';
import { logger } from '../../config/logger';

export class EmailsService {
  async scheduleEmails(userId: string, input: ScheduleEmailInput) {
    const { subject, body, recipients, startAt, delayMs, hourlyLimit } = input;

    // Dedupe recipients case-insensitively
    const uniqueRecipients = Array.from(
      new Set(recipients.map((r) => r.trim().toLowerCase()))
    );

    const senders = await senderService.getSenders();
    if (senders.length === 0) {
      throw new Error('No email senders available to dispatch emails');
    }

    const startTime = new Date(startAt).getTime();
    const totalCount = uniqueRecipients.length;

    // Build email rows in memory
    const emailDataToCreate = uniqueRecipients.map((toEmail, index) => {
      const scheduledTime = startTime + index * delayMs;
      const assignedSender = senders[index % senders.length];

      return {
        userId,
        senderId: assignedSender.id,
        toEmail,
        subject,
        body,
        scheduledAt: new Date(scheduledTime),
        status: EmailStatus.scheduled,
      };
    });

    // In one transaction, create Campaign and create the Email rows
    const { campaign, createdEmails } = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          userId,
          subject,
          body,
          startAt: new Date(startAt),
          delayMs,
          hourlyLimit,
          totalCount,
        },
      });

      // Insert all emails with campaignId
      const emailsWithCampaign = emailDataToCreate.map((e) => ({
        ...e,
        campaignId: campaign.id,
      }));

      // createMany returns { count: n }
      await tx.email.createMany({
        data: emailsWithCampaign,
      });

      const createdEmails = await tx.email.findMany({
        where: { campaignId: campaign.id },
        include: { sender: true },
      });

      return { campaign, createdEmails };
    });

    const now = Date.now();

    // After commit: enqueue jobs with emailQueue.addBulk in chunks of 500
    const CHUNK_SIZE = 500;
    for (let i = 0; i < createdEmails.length; i += CHUNK_SIZE) {
      const chunk = createdEmails.slice(i, i + CHUNK_SIZE);
      const jobs = chunk.map((email) => {
        const delay = Math.max(0, email.scheduledAt.getTime() - now);
        return {
          name: 'send',
          data: { emailId: email.id },
          opts: {
            jobId: email.id,
            delay,
            attempts: 3,
            backoff: {
              type: 'exponential' as const,
              delay: 5000,
            },
            removeOnComplete: {
              age: 86400,
              count: 5000,
            },
            removeOnFail: false,
          },
        };
      });

      await emailQueue.addBulk(jobs);
    }

    logger.info(
      { campaignId: campaign.id, total: createdEmails.length },
      'Enqueued campaign emails to BullMQ'
    );

    // Bulk index into Elasticsearch (safely handles ES offline)
    const docsToIndex: EmailDoc[] = createdEmails.map((email) => ({
      id: email.id,
      userId: email.userId,
      campaignId: email.campaignId,
      senderId: email.senderId,
      senderEmail: email.sender.email,
      toEmail: email.toEmail,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt,
      createdAt: email.createdAt,
    }));
    await indexerService.bulkIndexEmails(docsToIndex);

    return {
      campaignId: campaign.id,
      scheduled: createdEmails.length,
    };
  }

  async getScheduledEmails(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.email.findMany({
        where: {
          userId,
          status: { in: [EmailStatus.scheduled, EmailStatus.delayed] },
        },
        include: {
          sender: { select: { email: true } },
          campaign: { select: { id: true, subject: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.email.count({
        where: {
          userId,
          status: { in: [EmailStatus.scheduled, EmailStatus.delayed] },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async getSentEmails(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.email.findMany({
        where: {
          userId,
          status: { in: [EmailStatus.sent, EmailStatus.failed] },
        },
        include: {
          sender: { select: { email: true } },
          campaign: { select: { id: true, subject: true } },
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.email.count({
        where: {
          userId,
          status: { in: [EmailStatus.sent, EmailStatus.failed] },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }
}

export const emailsService = new EmailsService();
