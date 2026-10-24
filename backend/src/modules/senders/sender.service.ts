import nodemailer from 'nodemailer';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface CachedTransporter {
  senderId: string;
  email: string;
  transporter: nodemailer.Transporter;
}

export class SenderService {
  private transporterCache = new Map<string, nodemailer.Transporter>();
  private availableSenders: { id: string; email: string }[] = [];

  async bootstrapSenders(): Promise<void> {
    const existingCount = await prisma.sender.count();
    const needed = env.ETHEREAL_SENDER_COUNT - existingCount;

    if (needed > 0) {
      logger.info(`Bootstrapping ${needed} Ethereal email sender account(s)...`);
      for (let i = 0; i < needed; i++) {
        const testAccount = await nodemailer.createTestAccount();
        await prisma.sender.upsert({
          where: { email: testAccount.user },
          update: {
            smtpHost: testAccount.smtp.host,
            smtpPort: testAccount.smtp.port,
            smtpUser: testAccount.user,
            smtpPass: testAccount.pass,
            hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
          },
          create: {
            email: testAccount.user,
            smtpHost: testAccount.smtp.host,
            smtpPort: testAccount.smtp.port,
            smtpUser: testAccount.user,
            smtpPass: testAccount.pass,
            hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
          },
        });
        logger.info(`Created Ethereal sender: ${testAccount.user}`);
      }
    }

    // Load all senders into memory cache
    const senders = await prisma.sender.findMany();
    this.availableSenders = senders.map((s) => ({ id: s.id, email: s.email }));

    for (const sender of senders) {
      const transporter = nodemailer.createTransport({
        host: sender.smtpHost,
        port: sender.smtpPort,
        secure: sender.smtpPort === 465,
        auth: {
          user: sender.smtpUser,
          pass: sender.smtpPass,
        },
      });
      this.transporterCache.set(sender.id, transporter);
    }

    logger.info(`Initialized ${this.availableSenders.length} active email sender(s)`);
  }

  async getSenders() {
    if (this.availableSenders.length === 0) {
      await this.bootstrapSenders();
    }
    return this.availableSenders;
  }

  async getTransporter(senderId: string): Promise<nodemailer.Transporter> {
    const cached = this.transporterCache.get(senderId);
    if (cached) return cached;

    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender) {
      throw new Error(`Sender with id ${senderId} not found`);
    }

    const transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: {
        user: sender.smtpUser,
        pass: sender.smtpPass,
      },
    });

    this.transporterCache.set(sender.id, transporter);
    return transporter;
  }
}

export const senderService = new SenderService();
