import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * validate(schema, source?) — zod request validator middleware. On success,
 * replaces `req[source]` with the parsed (coerced/defaulted) data. On
 * failure, delegates to the error middleware with a 400 + VALIDATION code.
 */
export const validate =
  (schema: ZodSchema, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next({
        status: 400,
        message: 'Invalid request',
        code: 'VALIDATION',
        details: result.error.flatten(),
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[source] = result.data;
    next();
  };
