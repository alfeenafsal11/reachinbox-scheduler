import { esClient, EMAILS_INDEX } from './esClient';
import { logger } from '../../config/logger';

export interface EmailDoc {
  id: string;
  userId: string;
  campaignId: string;
  senderId: string;
  senderEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  createdAt: Date;
}

export class IndexerService {
  async indexEmail(doc: EmailDoc): Promise<void> {
    try {
      await esClient.index({
        index: EMAILS_INDEX,
        id: doc.id,
        document: {
          ...doc,
          scheduledAt: doc.scheduledAt.toISOString(),
          sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
          createdAt: doc.createdAt.toISOString(),
        },
      });
    } catch (err) {
      logger.warn({ err, emailId: doc.id }, 'ES indexEmail error (continuing)');
    }
  }

  async bulkIndexEmails(docs: EmailDoc[]): Promise<void> {
    if (docs.length === 0) return;
    try {
      const operations = docs.flatMap((doc) => [
        { index: { _index: EMAILS_INDEX, _id: doc.id } },
        {
          ...doc,
          scheduledAt: doc.scheduledAt.toISOString(),
          sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
          createdAt: doc.createdAt.toISOString(),
        },
      ]);
      await esClient.bulk({ refresh: true, operations });
    } catch (err) {
      logger.warn({ err, count: docs.length }, 'ES bulkIndexEmails error (continuing)');
    }
  }

  async updateEmailStatus(
    emailId: string,
    updates: {
      status: string;
      sentAt?: Date | null;
      scheduledAt?: Date | null;
      error?: string | null;
    }
  ): Promise<void> {
    try {
      const docUpdates: Record<string, unknown> = {
        status: updates.status,
      };
      if (updates.sentAt !== undefined) {
        docUpdates.sentAt = updates.sentAt ? updates.sentAt.toISOString() : null;
      }
      if (updates.scheduledAt !== undefined) {
        docUpdates.scheduledAt = updates.scheduledAt ? updates.scheduledAt.toISOString() : null;
      }
      if (updates.error !== undefined) {
        docUpdates.error = updates.error;
      }

      await esClient.update({
        index: EMAILS_INDEX,
        id: emailId,
        doc: docUpdates,
        doc_as_upsert: true,
      });
    } catch (err) {
      logger.warn({ err, emailId }, 'ES updateEmailStatus error (continuing)');
    }
  }
}

export const indexerService = new IndexerService();
