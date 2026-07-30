import type { NextFunction, Request, Response, RequestHandler } from 'express';

/**
 * Wrap async route handlers so thrown errors reach the Express error
 * middleware instead of becoming unhandled rejections.
 *
 * Usage: router.get('/x', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler =
  <Req extends Request = Request, Res extends Response = Response>(
    fn: (req: Req, res: Res, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as Req, res as Res, next)).catch(next);
  };
