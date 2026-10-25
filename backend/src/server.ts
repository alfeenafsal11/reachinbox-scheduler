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

import path from 'path';
import fs from 'fs';

const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // Allows Bull Board dashboard assets to render cleanly
}));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, or same-origin)
      if (!origin) return callback(null, true);
      if (
        origin === env.FRONTEND_URL ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.endsWith('.hf.space') ||
        origin.includes('huggingface.co') ||
        origin.includes('onrender.com')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
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

// Serve frontend static assets in production if built
const frontendDistCandidates = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
];

for (const candidate of frontendDistCandidates) {
  if (fs.existsSync(candidate)) {
    logger.info(`Serving static frontend build from ${candidate}`);
    app.use(express.static(candidate));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/admin') ||
        req.path.startsWith('/health')
      ) {
        return next();
      }
      res.sendFile(path.join(candidate, 'index.html'));
    });
    break;
  }
}

app.use(errorHandler);

import { senderService } from './modules/senders/sender.service';
import { initElasticsearch } from './modules/search/esClient';
import { reconcileQueue } from './queue/reconcile';

export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    app.listen(env.PORT, async () => {
      logger.info(`🚀 API Server running on port ${env.PORT} (${env.BACKEND_URL})`);
      try {
        await senderService.bootstrapSenders();
        await initElasticsearch();
        await reconcileQueue();
      } catch (err) {
        logger.error({ err }, 'Error during API server boot initialization');
      }
      resolve();
    });
  });
}

if (require.main === module) {
  startServer();
}

export { app };
