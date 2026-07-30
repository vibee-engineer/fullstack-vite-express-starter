import { Router } from 'express';

import { healthRouter } from './health';

/**
 * Root API router — mounted at `/api` in app.ts. Add one line per resource
 * as the app grows: `router.use('/users', usersRouter);`.
 */
export const apiRouter = Router();

apiRouter.use(healthRouter);
