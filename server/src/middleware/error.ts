import type { ErrorRequestHandler } from 'express';

import { env } from '../env';
import { isSlotTaken, slotTaken } from '../services/booking/overlap';

interface HttpError {
  status?: number;
  type?: string;
  message?: string;
  code?: string;
  details?: unknown;
}

/**
 * JSON error middleware — last in the chain. Normalizes every thrown value
 * to `{ error: { message, code, details? } }` so the client's axios
 * interceptor has a single shape to unwrap.
 */
export const errorMiddleware: ErrorRequestHandler = (thrown: HttpError, req, res, _next) => {
  // A Postgres EXCLUDE violation (23P01) is a double booking, not a crash.
  const err: HttpError = isSlotTaken(thrown) ? slotTaken() : thrown;
  const status = err.status ?? 500;
  const message =
    env.NODE_ENV === 'production' && status === 500
      ? 'Internal Server Error'
      : (err.message ?? 'Unknown error');

  // Attach for pino-http.
  (req as unknown as { log?: { error: (obj: unknown, msg?: string) => void } }).log?.error(
    { err: thrown },
    'request failed',
  );

  res.status(status).json({
    error: {
      message,
      code: err.code ?? (err.type === 'entity.parse.failed' ? 'INVALID_JSON' : undefined),
      ...(err.details ? { details: err.details } : {}),
    },
  });
};
