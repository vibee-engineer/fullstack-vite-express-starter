/**
 * scheduler.test.ts — the recurring-job scheduler, driven by a deterministic
 * manual clock (no real or fake global timers), so every tick is exact.
 */

import { describe, expect, it, vi } from 'vitest';

import { msUntilDaily, Scheduler, type JobLogger } from '../scheduler';

/** Drain the microtask queue so an already-started async fire settles. */
const flush = () => new Promise<void>((r) => setImmediate(r));

/**
 * A manual timer harness: `setTimer` records a callback + due time, `advance`
 * fires everything due (in order, re-arming as it goes) and awaits each async
 * callback. This makes the scheduler's self-rescheduling chain fully testable.
 */
function makeClock() {
  let now = 0;
  let seq = 1;
  const timers = new Map<number, { fn: () => void | Promise<void>; at: number }>();

  return {
    now: () => now,
    setTimer(fn: () => void, ms: number) {
      const handle = seq++;
      timers.set(handle, { fn, at: now + ms });
      return handle as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer(handle: ReturnType<typeof setTimeout>) {
      timers.delete(handle as unknown as number);
    },
    async advance(ms: number) {
      const target = now + ms;
      // Fire the earliest due timer, repeatedly — a fired timer may re-arm a
      // new one that is also due within this window.
      for (;;) {
        let next: [number, { fn: () => void | Promise<void>; at: number }] | null = null;
        for (const entry of timers) {
          if (entry[1].at <= target && (!next || entry[1].at < next[1].at)) next = entry;
        }
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        await next[1].fn();
      }
      now = target;
    },
    get pending() {
      return timers.size;
    },
  };
}

function spyLogger(): JobLogger & { infos: unknown[]; errors: unknown[] } {
  const infos: unknown[] = [];
  const errors: unknown[] = [];
  return {
    infos,
    errors,
    info: (o) => infos.push(o),
    error: (o) => errors.push(o),
  };
}

describe('msUntilDaily', () => {
  it('returns the delay to a later time the same day', () => {
    const now = new Date(2026, 0, 1, 1, 0, 0); // 01:00
    expect(msUntilDaily('03:00', now)).toBe(2 * 60 * 60 * 1000);
  });

  it('rolls to tomorrow when the time already passed today', () => {
    const now = new Date(2026, 0, 1, 4, 0, 0); // 04:00
    expect(msUntilDaily('03:00', now)).toBe(23 * 60 * 60 * 1000);
  });

  it('treats the exact current minute as tomorrow (never a 0 delay loop)', () => {
    const now = new Date(2026, 0, 1, 3, 0, 0, 0); // exactly 03:00:00.000
    expect(msUntilDaily('03:00', now)).toBe(24 * 60 * 60 * 1000);
  });

  it('rejects malformed or out-of-range times', () => {
    const now = new Date(2026, 0, 1);
    expect(() => msUntilDaily('3pm', now)).toThrow();
    expect(() => msUntilDaily('25:00', now)).toThrow();
    expect(() => msUntilDaily('03:99', now)).toThrow();
  });
});

describe('register validation', () => {
  it('rejects a duplicate job name', () => {
    const s = new Scheduler();
    s.register({ name: 'a', everyMs: 1000, handler: () => {} });
    expect(() => s.register({ name: 'a', everyMs: 1000, handler: () => {} })).toThrow(/Duplicate/);
  });

  it('rejects a non-positive interval', () => {
    const s = new Scheduler();
    expect(() => s.register({ name: 'a', everyMs: 0, handler: () => {} })).toThrow(/everyMs/);
  });

  it('validates dailyAt eagerly at registration', () => {
    const s = new Scheduler();
    expect(() => s.register({ name: 'a', dailyAt: 'noon', handler: () => {} })).toThrow();
  });

  it('refuses registration after start and counts size', () => {
    const clock = makeClock();
    const s = new Scheduler({ ...clock });
    s.register({ name: 'a', everyMs: 1000, handler: () => {} });
    expect(s.size).toBe(1);
    s.start();
    expect(() => s.register({ name: 'b', everyMs: 1000, handler: () => {} })).toThrow(
      /after start/,
    );
    s.stop();
  });
});

describe('interval jobs', () => {
  it('fires every interval, not before', async () => {
    const clock = makeClock();
    const handler = vi.fn();
    const s = new Scheduler({ ...clock, logger: spyLogger() });
    s.register({ name: 'tick', everyMs: 1000, handler });
    s.start();

    await clock.advance(999);
    expect(handler).toHaveBeenCalledTimes(0);
    await clock.advance(1); // t=1000
    expect(handler).toHaveBeenCalledTimes(1);
    await clock.advance(2000); // t=3000
    expect(handler).toHaveBeenCalledTimes(3);
    s.stop();
  });

  it('runOnStart fires immediately, then on the interval', async () => {
    const clock = makeClock();
    const handler = vi.fn();
    const s = new Scheduler({ ...clock, logger: spyLogger() });
    s.register({ name: 'tick', everyMs: 1000, handler, runOnStart: true });
    s.start();
    expect(handler).toHaveBeenCalledTimes(1); // immediate
    await flush(); // let the immediate run settle so the next tick isn't skipped
    await clock.advance(1000);
    expect(handler).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it('stop() halts all further fires', async () => {
    const clock = makeClock();
    const handler = vi.fn();
    const s = new Scheduler({ ...clock, logger: spyLogger() });
    s.register({ name: 'tick', everyMs: 1000, handler });
    s.start();
    await clock.advance(1000);
    expect(handler).toHaveBeenCalledTimes(1);
    s.stop();
    await clock.advance(10_000);
    expect(handler).toHaveBeenCalledTimes(1); // no more
    expect(clock.pending).toBe(0); // no leaked timers
  });

  it('isolates a throwing handler and keeps scheduling', async () => {
    const clock = makeClock();
    const logger = spyLogger();
    const handler = vi.fn(() => {
      throw new Error('boom');
    });
    const s = new Scheduler({ ...clock, logger });
    s.register({ name: 'bad', everyMs: 1000, handler });
    s.start();
    await clock.advance(3000);
    expect(handler).toHaveBeenCalledTimes(3); // kept firing despite throwing
    expect(logger.errors.length).toBe(3);
    s.stop();
  });

  it('skips a tick when the previous run is still in flight (overlap guard)', async () => {
    const clock = makeClock();
    const logger = spyLogger();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const handler = vi.fn(() => gate); // stays pending until released

    const s = new Scheduler({ ...clock, logger });
    // runOnStart begins a long run at t=0; the t=1000 tick should be skipped.
    s.register({ name: 'slow', everyMs: 1000, handler, runOnStart: true });
    s.start();
    expect(handler).toHaveBeenCalledTimes(1); // the long run started

    await clock.advance(1000); // tick fires while the first run is still pending
    expect(handler).toHaveBeenCalledTimes(1); // skipped, not re-entered
    expect(logger.infos.some((o) => (o as { job?: string }).job === 'slow')).toBe(true);

    release();
    await gate;
    s.stop();
  });
});

describe('daily jobs', () => {
  it('fires at the computed delay, then re-arms 24h later', async () => {
    const clock = makeClock(); // now starts at 0 = 1970-01-01T00:00:00Z
    const handler = vi.fn();
    const s = new Scheduler({ ...clock, logger: spyLogger() });
    // At epoch (local). Register for a time; assert it fires once at the delay
    // and again a day later.
    const at = new Date(clock.now());
    const hhmm = `${String((at.getHours() + 2) % 24).padStart(2, '0')}:00`;
    s.register({ name: 'daily', dailyAt: hhmm, handler });
    s.start();

    const delay = msUntilDaily(hhmm, new Date(clock.now()));
    await clock.advance(delay - 1);
    expect(handler).toHaveBeenCalledTimes(0);
    await clock.advance(1);
    expect(handler).toHaveBeenCalledTimes(1);
    await clock.advance(24 * 60 * 60 * 1000);
    expect(handler).toHaveBeenCalledTimes(2);
    s.stop();
  });
});
