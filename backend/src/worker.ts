import { createEmailWorker } from './queue/email.worker';
import { senderService } from './modules/senders/sender.service';
import { reconcileQueue } from './queue/reconcile';
import { logger } from './config/logger';

async function bootstrap() {
  logger.info('🚀 Starting standalone Email Worker process...');

  // Ensure Ethereal senders are bootstrapped and cached
  await senderService.bootstrapSenders();

  // Run startup queue reconciliation
  await reconcileQueue();

  const worker = createEmailWorker();
  logger.info('✅ Email Worker is listening for jobs on BullMQ');

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Closing email worker gracefully...`);
    try {
      await worker.close();
      logger.info('Email worker closed cleanly. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during worker graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error({ err }, 'Fatal error starting Email Worker process');
    process.exit(1);
  });
}

export { bootstrap };
