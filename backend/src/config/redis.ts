import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export function createRedisClient(name = 'default'): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
  });

  client.on('connect', () => {
    logger.info({ client: name }, `Redis connected: ${name}`);
  });

  client.on('error', (err) => {
    logger.error({ err, client: name }, `Redis error on ${name}`);
  });

  return client;
}

// Shared redis instance for app-level queries, rate limiting, and caching
export const redis = createRedisClient('app');
