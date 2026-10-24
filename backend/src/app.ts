import './server';
import { bootstrap } from './worker';
import { logger } from './config/logger';

// Start the background worker alongside the HTTP server
bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to initialize embedded background worker');
});
