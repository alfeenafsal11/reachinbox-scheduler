import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';

import { authRouter } from './modules/auth/auth.routes';

const app = express();

app.use(helmet());
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

// Auth routes
app.use('/auth', authRouter);

app.use(errorHandler);

if (require.main === module) {
  app.listen(env.PORT, () => {
    logger.info(`🚀 API Server running on port ${env.PORT} (${env.BACKEND_URL})`);
  });
}

export { app };
