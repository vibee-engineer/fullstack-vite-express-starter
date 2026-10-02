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

  // Trust the private hops in front of us (nginx in compose, Fly's proxy over
  // 6PN, docker networks) and nothing else. Express then takes the first
  // UNTRUSTED address from the right of X-Forwarded-For: the real client,
  // which a client cannot forge by prepending entries. Never `true`: that
  // trusts any client-sent header (rate limits and audit IPs become spoofable).
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

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
