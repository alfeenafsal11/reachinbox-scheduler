import { Client } from '@elastic/elasticsearch';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  maxRetries: 2,
  requestTimeout: 2000,
});

export const EMAILS_INDEX = 'emails';

export async function initElasticsearch(): Promise<boolean> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      logger.info(`Creating Elasticsearch index: ${EMAILS_INDEX}`);
      await esClient.indices.create({
        index: EMAILS_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            toEmail: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      logger.info(`Created Elasticsearch index: ${EMAILS_INDEX}`);
    }
    return true;
  } catch (err) {
    logger.warn({ err }, 'Elasticsearch is currently unreachable. Continuing with DB fallback.');
    return false;
  }
}
