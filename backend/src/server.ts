import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';

import { authRouter } from './modules/auth/auth.routes';
import { emailsRouter } from './modules/emails/emails.routes';
import { slackRouter } from './modules/slack/slack.routes';
import { searchRouter } from './modules/search/routes';
import { requireAuth } from './middleware/auth';
import { emailQueue } from './queue/email.queue';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // Allows Bull Board dashboard assets to render cleanly
}));
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Bull Board UI for email queue inspection (mounted behind requireAuth)
const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: bullBoardAdapter,
});
app.use('/admin/queues', requireAuth, bullBoardAdapter.getRouter());

// Auth routes
app.use('/auth', authRouter);

// Search routes
app.use('/api/emails', searchRouter);

// Emails API routes
app.use('/api/emails', emailsRouter);

// Slack API routes
app.use('/api/slack', slackRouter);

app.use(errorHandler);

import { senderService } from './modules/senders/sender.service';
import { initElasticsearch } from './modules/search/esClient';
import { reconcileQueue } from './queue/reconcile';

if (require.main === module) {
  app.listen(env.PORT, async () => {
    logger.info(`🚀 API Server running on port ${env.PORT} (${env.BACKEND_URL})`);
    try {
      await senderService.bootstrapSenders();
      await initElasticsearch();
      await reconcileQueue();
    } catch (err) {
      logger.error({ err }, 'Error during API server boot initialization');
    }
  });
}

export { app };
