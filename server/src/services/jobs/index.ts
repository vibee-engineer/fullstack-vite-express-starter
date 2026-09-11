/**
 * jobs — in-process background work for a single-container app.
 *
 * Two primitives, zero dependencies, no Redis:
 *
 *   • Scheduler       recurring work — "every hour", "daily at 03:00".
 *   • BackgroundRunner one-off work — "do this after the response is sent",
 *                      with bounded concurrency + retry/backoff.
 *
 * ── How the agent should use this ──────────────────────────────────────────
 *
 * RECURRING (e.g. nightly cleanup, hourly digest):
 *
 *   // in registerJobs() below
 *   scheduler.register({
 *     name: 'expire-trials',
 *     dailyAt: '02:00',
 *     handler: async () => { await billingService.expireTrials(); },
 *   });
 *
 * FIRE-AND-FORGET (e.g. welcome email on signup) — from a route handler:
 *
 *   import { runner } from '../services/jobs';
 *   runner.enqueue('welcome-email', () => emailService.sendWelcome(user.email));
 *   res.status(201).json({ user });   // returns without waiting on the email
 *
 * Boot wiring lives in server/src/index.ts: it calls `registerJobs()` then
 * `scheduler.start()`, and `runner.drain()` on shutdown. If no jobs are
 * registered, the scheduler starts empty (a no-op) — this whole module is
 * opt-in and costs nothing until you register something.
 *
 * REMEMBER: handlers run in memory in ONE process. Make them idempotent, and
 * for work that must never be lost, persist a row and reconcile on boot rather
 * than trusting the queue.
 */

import { logger } from '../../logger';
import { BackgroundRunner } from './runner';
import { Scheduler } from './scheduler';

export * from './scheduler';
export * from './runner';

/** App-wide singletons. Import these; don't new-up your own. */
export const scheduler = new Scheduler({ logger });
export const runner = new BackgroundRunner({ logger });

/**
 * Register every recurring job here. Called once at boot, before
 * `scheduler.start()`. Left empty in the starter — add `scheduler.register(...)`
 * calls as the app grows. Keeping registration in one function makes the app's
 * full set of scheduled work greppable in one place.
 */
export function registerJobs(): void {
  // scheduler.register({ name: 'example', everyMs: 60 * 60 * 1000, handler: async () => {} });
}
