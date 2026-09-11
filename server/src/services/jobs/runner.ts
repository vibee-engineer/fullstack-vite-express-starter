/**
 * runner.ts — a fire-and-forget background runner for ONE-OFF async work.
 *
 * The companion to scheduler.ts: where the scheduler handles "every hour", this
 * handles "do this after the response is sent" — send a welcome email on
 * signup, warm a cache, kick off a slow export — without making the user wait
 * and without an unhandled rejection crashing the process.
 *
 * Same single-container philosophy as the scheduler: in-memory queue, bounded
 * concurrency, retry with backoff, every task isolated. Tasks do NOT survive a
 * restart — if a task MUST NOT be lost, write a row first and reconcile on boot;
 * this runner is for work that is fine to retry-then-drop.
 */

import type { JobHandler, JobLogger } from './scheduler';

export interface EnqueueOptions {
  /** Total attempts before giving up. Default 3 (1 try + 2 retries). */
  retries?: number;
  /** Base backoff in ms; attempt N waits baseBackoffMs * 2**(N-1). Default 200. */
  baseBackoffMs?: number;
}

export interface RunnerDeps {
  logger?: JobLogger;
  /** Max tasks running at once. Default 4. */
  concurrency?: number;
  /** Injectable delay (tests pass an instant resolver). Default real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const consoleLogger: JobLogger = {
  info: (o, m) => console.log(m ?? '', o),
  error: (o, m) => console.error(m ?? '', o),
};

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Queued {
  name: string;
  fn: JobHandler;
  retries: number;
  baseBackoffMs: number;
}

export class BackgroundRunner {
  private readonly logger: JobLogger;
  private readonly concurrency: number;
  private readonly sleep: (ms: number) => Promise<void>;

  private readonly queue: Queued[] = [];
  private active = 0;
  /** Resolvers waiting on `drain()`. */
  private drainWaiters: Array<() => void> = [];

  constructor(deps: RunnerDeps = {}) {
    this.logger = deps.logger ?? consoleLogger;
    this.concurrency = Math.max(1, deps.concurrency ?? 4);
    this.sleep = deps.sleep ?? realSleep;
  }

  /** Tasks queued but not yet started. */
  get pending(): number {
    return this.queue.length;
  }

  /** Tasks currently executing. */
  get inFlight(): number {
    return this.active;
  }

  /**
   * Schedule `fn` to run in the background. Returns immediately. A failure is
   * retried with exponential backoff up to `retries` attempts, then logged and
   * dropped — it never rejects into the caller.
   */
  enqueue(name: string, fn: JobHandler, options: EnqueueOptions = {}): void {
    this.queue.push({
      name,
      fn,
      retries: Math.max(1, options.retries ?? 3),
      baseBackoffMs: Math.max(0, options.baseBackoffMs ?? 200),
    });
    this.pump();
  }

  /** Start as many queued tasks as concurrency allows. */
  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift() as Queued;
      this.active += 1;
      void this.run(task).finally(() => {
        this.active -= 1;
        // A slot freed up — try to start more, or signal drain if fully idle.
        if (this.queue.length > 0) this.pump();
        else if (this.active === 0) this.settleDrain();
      });
    }
  }

  private async run(task: Queued): Promise<void> {
    for (let attempt = 1; attempt <= task.retries; attempt += 1) {
      try {
        await task.fn();
        if (attempt > 1) {
          this.logger.info({ job: task.name, attempt }, 'background task recovered');
        }
        return;
      } catch (err) {
        const last = attempt === task.retries;
        this.logger.error(
          { job: task.name, attempt, retries: task.retries, err },
          last ? 'background task failed — giving up' : 'background task errored — will retry',
        );
        if (last) return;
        await this.sleep(task.baseBackoffMs * 2 ** (attempt - 1));
      }
    }
  }

  /**
   * Resolve once the queue is empty AND nothing is in flight. For graceful
   * shutdown and tests. If already idle, resolves on the next microtask.
   */
  drain(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => this.drainWaiters.push(resolve));
  }

  private settleDrain(): void {
    if (this.active === 0 && this.queue.length === 0 && this.drainWaiters.length > 0) {
      const waiters = this.drainWaiters;
      this.drainWaiters = [];
      for (const resolve of waiters) resolve();
    }
  }
}
