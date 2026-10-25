import { startServer } from './server';
import { bootstrap } from './worker';
import { logger } from './config/logger';

async function main() {
  await startServer();
  await bootstrap();
  logger.info('🚀 ReachInbox unified server (API + Worker) running successfully');
}

main().catch((err) => {
  logger.error({ err }, 'Failed to initialize unified server');
  process.exit(1);
});
