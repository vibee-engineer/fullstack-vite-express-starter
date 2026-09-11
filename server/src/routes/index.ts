import { Router } from 'express';

import { authRouter } from './auth';
import { healthRouter } from './health';
import { tasksRouter } from './tasks';

/**
 * Root API router — mounted at `/api` in app.ts. Add one line per resource
 * as the app grows: `router.use('/users', usersRouter);`.
 */
export const apiRouter = Router();

apiRouter.use(healthRouter);
// Email + password auth (opt-in). Remove this line for an app with no login.
apiRouter.use('/auth', authRouter);
// Reference resource — the shape to copy. See routes/tasks.ts.
apiRouter.use('/tasks', tasksRouter);
