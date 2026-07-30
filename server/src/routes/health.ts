import { Router } from 'express';

import { asyncHandler } from '../middleware/async-handler';

export const healthRouter = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }),
);
