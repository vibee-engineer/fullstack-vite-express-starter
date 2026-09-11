/**
 * scheduler.ts — an in-process scheduler for RECURRING work.
 *
 * Why in-process and not BullMQ/pg-boss/Redis: a per-customer app runs as a
 * single container. Pulling in Redis (BullMQ) or a Postgres-only queue
 * (pg-boss) buys multi-worker coordination this app doesn't need and a hard
 * dependency it can't always satisfy (the Mongo variant has no Postgres). So
 * the starter ships the 90% case — "run this every hour", "run this at 03:00" —
 * with zero dependencies.
 *
 * Trade-offs, stated plainly so nobody is surprised:
 *   - Jobs live in memory. A restart re-arms them from now; nothing is
 *     persisted or replayed. Design each handler to be idempotent.
 *   - One process = one runner. Don't scale this app past a single instance
 *     expecting a job to fire once cluster-wide — it fires once PER instance.
 *   - Overlap is prevented per job: if a run is still going when the next tick
 *     arrives, that tick is skipped (logged), not queued.
 *
 * Everything is injectable (clock + timers + logger) so tests use fake timers
 * and assert exact tick behavior without waiting on wall-clock time.
 */

export type JobHandler = () => void | Promise<void>;

/** Minimal logger shape — the app's pino logger satisfies it; tests pass a spy. */
export interface JobLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface IntervalJob {
  name: string;
  /** Fire every `everyMs` milliseconds. Must be > 0. */
  everyMs: number;
  handler: JobHandler;
  /** Run once immediately on start, then on the interval. Default false. */
  runOnStart?: boolean;
}

export interface DailyJob {
  name: string;
  /** 24h local time "HH:MM", e.g. "03:00". */
  dailyAt: string;
  handler: JobHandler;
}

export type JobSpec = IntervalJob | DailyJob;

const isDaily = (job: JobSpec): job is DailyJob => 'dailyAt' in job;

/**
 * Milliseconds from `now` until the next local `HH:MM`. If that time already
 * passed today, returns the delay to tomorrow's occurrence. Exported for tests.
 */
export function msUntilDaily(hhmm: string, now: Date): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) throw new Error(`Invalid dailyAt "${hhmm}" — expected "HH:MM".`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid dailyAt "${hhmm}" — out of range.`);

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** Injectable timer/clock surface, defaulting to the platform globals. */
export interface SchedulerDeps {
  logger?: JobLogger;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

const consoleLogger: JobLogger = {
  info: (o, m) => console.log(m ?? '', o),
  error: (o, m) => console.error(m ?? '', o),
};

const DAY_MS = 24 * 60 * 60 * 1000;

export class Scheduler {
  private readonly jobs: JobSpec[] = [];
  private readonly handles = new Set<ReturnType<typeof setTimeout>>();
  private readonly running = new Set<string>();
  private started = false;

  private readonly logger: JobLogger;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void;

  constructor(deps: SchedulerDeps = {}) {
    this.logger = deps.logger ?? consoleLogger;
    this.now = deps.now ?? (() => Date.now());
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h));
  }

  /** Register a job. Names must be unique. Chainable. Only valid before start. */
  register(job: JobSpec): this {
    if (this.started) throw new Error('Cannot register a job after start().');
    if (this.jobs.some((j) => j.name === job.name)) {
      throw new Error(`Duplicate job name "${job.name}".`);
    }
    if (!isDaily(job) && !(job.everyMs > 0)) {
      throw new Error(`Job "${job.name}" needs everyMs > 0.`);
    }
    // Validate the dailyAt format eagerly, at registration, not at first tick.
    if (isDaily(job)) msUntilDaily(job.dailyAt, new Date(this.now()));
    this.jobs.push(job);
    return this;
  }

  /** How many jobs are registered. */
  get size(): number {
    return this.jobs.length;
  }

  /** Arm every registered job. Idempotent-guarded (throws if already started). */
  start(): void {
    if (this.started) throw new Error('Scheduler already started.');
    this.started = true;
    for (const job of this.jobs) {
      if (isDaily(job)) this.armDaily(job);
      else this.armInterval(job);
    }
    this.logger.info({ jobs: this.jobs.length }, 'scheduler started');
  }

  /** Cancel every pending timer. Safe to call even if not started. */
  stop(): void {
    for (const handle of this.handles) this.clearTimer(handle);
    this.handles.clear();
    this.started = false;
  }

  private armInterval(job: IntervalJob): void {
    // A self-rescheduling setTimeout rather than setInterval: the next gap is
    // measured AFTER each run completes, so a handler slower than the interval
    // never stacks ticks (and `fire`'s overlap guard is a second belt).
    const schedule = () => {
      const handle = this.setTimer(async () => {
        this.handles.delete(handle);
        await this.fire(job.name, job.handler);
        if (this.started) schedule();
      }, job.everyMs);
      this.handles.add(handle);
    };
    if (job.runOnStart) void this.fire(job.name, job.handler);
    schedule();
  }

  private armDaily(job: DailyJob): void {
    const schedule = (delay: number) => {
      const handle = this.setTimer(async () => {
        this.handles.delete(handle);
        await this.fire(job.name, job.handler);
        if (this.started) schedule(DAY_MS);
      }, delay);
      this.handles.add(handle);
    };
    schedule(msUntilDaily(job.dailyAt, new Date(this.now())));
  }

  /** Run one job with overlap-guard + error isolation. Never rejects. */
  private async fire(name: string, handler: JobHandler): Promise<void> {
    if (this.running.has(name)) {
      this.logger.info({ job: name }, 'job still running — skipping this tick');
      return;
    }
    this.running.add(name);
    const startedAt = this.now();
    try {
      await handler();
      this.logger.info({ job: name, ms: this.now() - startedAt }, 'job ok');
    } catch (err) {
      this.logger.error({ job: name, err }, 'job failed');
    } finally {
      this.running.delete(name);
    }
  }
}
