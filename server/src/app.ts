import express from 'express';
import pinoHttp from 'pino-http';

import { logger } from './logger';
import { corsMiddleware } from './middleware/cors';
import { helmetMiddleware } from './middleware/helmet';
import { errorMiddleware } from './middleware/error';
import { apiRouter } from './routes';

/**
 * createApp — factory. Kept factory-shaped (not top-level exports) so
 * integration tests can `createApp()` per suite without side effects.
 */
export function createApp() {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);

  // 404 for unmatched /api routes.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  });

  app.use(errorMiddleware);

  return app;
}
