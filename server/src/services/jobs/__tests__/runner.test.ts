/**
 * runner.test.ts — the background runner: concurrency, retry/backoff, isolation,
 * and drain. `sleep` is injected as instant so backoff never waits real time.
 */

import { describe, expect, it, vi } from 'vitest';

import { BackgroundRunner } from '../runner';
import type { JobLogger } from '../scheduler';

function spyLogger(): JobLogger & { errors: unknown[]; infos: unknown[] } {
  const errors: unknown[] = [];
  const infos: unknown[] = [];
  return { errors, infos, error: (o) => errors.push(o), info: (o) => infos.push(o) };
}

const instantSleep = () => Promise.resolve();

/** A promise plus its resolver, for controlling when a task completes. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('BackgroundRunner', () => {
  it('runs an enqueued task and drains', async () => {
    const runner = new BackgroundRunner({ logger: spyLogger(), sleep: instantSleep });
    const fn = vi.fn(async () => {});
    runner.enqueue('t', fn);
    await runner.drain();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns from enqueue immediately (does not block on the task)', async () => {
    const runner = new BackgroundRunner({ logger: spyLogger(), sleep: instantSleep });
    const gate = deferred();
    runner.enqueue('t', () => gate.promise);
    // Synchronously after enqueue, the task is in flight and enqueue returned.
    expect(runner.inFlight).toBe(1);
    gate.resolve();
    await runner.drain();
  });

  it('drain() on an idle runner resolves', async () => {
    const runner = new BackgroundRunner({ sleep: instantSleep });
    await expect(runner.drain()).resolves.toBeUndefined();
  });

  it('respects the concurrency limit', async () => {
    const runner = new BackgroundRunner({ concurrency: 2, logger: spyLogger(), sleep: instantSleep });
    const gates = [deferred(), deferred(), deferred(), deferred()];
    let peak = 0;
    gates.forEach((g, i) => {
      runner.enqueue(`t${i}`, async () => {
        peak = Math.max(peak, runner.inFlight);
        await g.promise;
      });
    });

    expect(runner.inFlight).toBe(2); // only 2 start
    expect(runner.pending).toBe(2); // 2 wait

    gates[0]!.resolve();
    gates[1]!.resolve();
    await Promise.resolve(); // let the freed slots pump
    await Promise.resolve();
    expect(runner.inFlight).toBe(2); // the next 2 took the slots

    gates[2]!.resolve();
    gates[3]!.resolve();
    await runner.drain();
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('retries a failing task and recovers', async () => {
    const logger = spyLogger();
    const runner = new BackgroundRunner({ logger, sleep: instantSleep });
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error(`fail ${attempts}`);
    });
    runner.enqueue('flaky', fn, { retries: 3 });
    await runner.drain();
    expect(fn).toHaveBeenCalledTimes(3);
    expect(logger.infos.some((o) => (o as { job?: string }).job === 'flaky')).toBe(true); // recovered log
  });

  it('gives up after the retry budget and never rejects', async () => {
    const logger = spyLogger();
    const runner = new BackgroundRunner({ logger, sleep: instantSleep });
    const fn = vi.fn(async () => {
      throw new Error('always');
    });
    runner.enqueue('doomed', fn, { retries: 2 });
    await runner.drain(); // must resolve — a doomed task can't hang shutdown
    expect(fn).toHaveBeenCalledTimes(2);
    expect(logger.errors.length).toBe(2); // one per attempt
  });

  it('isolates a failing task from the others', async () => {
    const runner = new BackgroundRunner({ logger: spyLogger(), sleep: instantSleep });
    const ok = vi.fn(async () => {});
    const bad = vi.fn(async () => {
      throw new Error('boom');
    });
    runner.enqueue('bad', bad, { retries: 1 });
    runner.enqueue('ok', ok);
    await runner.drain();
    expect(ok).toHaveBeenCalledTimes(1); // ran despite the sibling throwing
  });

  it('applies exponential backoff between attempts', async () => {
    const delays: number[] = [];
    const runner = new BackgroundRunner({
      logger: spyLogger(),
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });
    const fn = vi.fn(async () => {
      throw new Error('nope');
    });
    runner.enqueue('backoff', fn, { retries: 4, baseBackoffMs: 100 });
    await runner.drain();
    // Sleeps happen between attempts (not after the last): 3 sleeps for 4 tries.
    expect(delays).toEqual([100, 200, 400]);
  });
});
