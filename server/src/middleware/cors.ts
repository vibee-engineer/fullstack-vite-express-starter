import cors from 'cors';

import { env } from '../env';

/**
 * corsMiddleware — thin wrapper so per-route overrides (e.g. a public
 * webhook endpoint that needs `origin: true`) can import a consistent
 * default. app.ts uses this at the app level.
 */
export const corsMiddleware = cors({
  origin: env.ALLOWED_ORIGIN,
  credentials: true,
});
