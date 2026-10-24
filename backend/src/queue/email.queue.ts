import { Queue } from 'bullmq';
import { env } from '../config/env';
import { createRedisClient } from '../config/redis';

export interface EmailJobData {
  emailId: string;
}

export const emailQueue = new Queue<EmailJobData>(env.QUEUE_NAME, {
  connection: createRedisClient('email-queue'),
  defaultJobOptions: {
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
  },
});
