import type { ErrorRequestHandler } from 'express';

import { env } from '../env';

interface HttpError {
  status?: number;
  message?: string;
  code?: string;
  details?: unknown;
}

/**
 * JSON error middleware — last in the chain. Normalizes every thrown value
 * to `{ error: { message, code, details? } }` so the client's axios
 * interceptor has a single shape to unwrap.
 */
export const errorMiddleware: ErrorRequestHandler = (err: HttpError, req, res, _next) => {
  const status = err.status ?? 500;
  const message =
    env.NODE_ENV === 'production' && status === 500
      ? 'Internal Server Error'
      : (err.message ?? 'Unknown error');

  // Attach for pino-http.
  (req as unknown as { log?: { error: (obj: unknown, msg?: string) => void } }).log?.error(
    { err },
    'request failed',
  );

  res.status(status).json({
    error: {
      message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    },
  });
};
