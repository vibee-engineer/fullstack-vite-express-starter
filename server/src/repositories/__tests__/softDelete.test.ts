import { describe, it, expect, vi } from 'vitest';

import {
  NOT_DELETED,
  activeWhere,
  trashWhere,
  isRecordNotFound,
  softRemove,
  restore,
  type SoftDeleteDelegate,
} from '../softDelete';

/** A P2025 (record-not-found) the way Prisma throws it. */
const notFound = Object.assign(new Error('Record to update not found.'), { code: 'P2025' });

function fakeDelegate(behaviour: 'ok' | 'notfound' | 'boom' = 'ok') {
  const calls: Array<{ where: { id: string }; data: { deletedAt: Date | null } }> = [];
  const delegate: SoftDeleteDelegate = {
    async update(args) {
      calls.push(args);
      if (behaviour === 'notfound') throw notFound;
      if (behaviour === 'boom') throw new Error('connection reset');
      return { id: args.where.id, ...args.data };
    },
  };
  return { delegate, calls };
}

describe('softDelete — where fragments', () => {
  it('activeWhere hides soft-deleted rows and preserves the caller filter', () => {
    expect(activeWhere()).toEqual({ deletedAt: null });
    expect(activeWhere({ status: 'todo' })).toEqual({ status: 'todo', deletedAt: null });
    expect(NOT_DELETED).toEqual({ deletedAt: null });
  });

  it('trashWhere selects only soft-deleted rows and preserves the caller filter', () => {
    expect(trashWhere()).toEqual({ deletedAt: { not: null } });
    expect(trashWhere({ status: 'done' })).toEqual({ status: 'done', deletedAt: { not: null } });
  });
});

describe('softDelete — isRecordNotFound', () => {
  it('is true only for a Prisma P2025', () => {
    expect(isRecordNotFound(notFound)).toBe(true);
    expect(isRecordNotFound(new Error('nope'))).toBe(false);
    expect(isRecordNotFound({ code: 'P2002' })).toBe(false);
    expect(isRecordNotFound(null)).toBe(false);
    expect(isRecordNotFound(undefined)).toBe(false);
  });
});

describe('softDelete — softRemove', () => {
  it('sets deletedAt to a Date and returns true', async () => {
    const { delegate, calls } = fakeDelegate('ok');
    const ok = await softRemove(delegate, 'row1');
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.where).toEqual({ id: 'row1' });
    expect(call?.data.deletedAt).toBeInstanceOf(Date);
  });

  it('returns false when the row does not exist (P2025) — route makes it a 404', async () => {
    const { delegate } = fakeDelegate('notfound');
    expect(await softRemove(delegate, 'missing')).toBe(false);
  });

  it('rethrows a real error (not a swallowed failure)', async () => {
    const { delegate } = fakeDelegate('boom');
    await expect(softRemove(delegate, 'row1')).rejects.toThrow('connection reset');
  });
});

describe('softDelete — restore', () => {
  it('clears deletedAt (sets null) and returns true', async () => {
    const { delegate, calls } = fakeDelegate('ok');
    const ok = await restore(delegate, 'row1');
    expect(ok).toBe(true);
    expect(calls[0]?.data.deletedAt).toBeNull();
  });

  it('returns false when the row does not exist', async () => {
    const { delegate } = fakeDelegate('notfound');
    expect(await restore(delegate, 'missing')).toBe(false);
  });

  it('rethrows a real error', async () => {
    const { delegate } = fakeDelegate('boom');
    await expect(restore(delegate, 'row1')).rejects.toThrow('connection reset');
  });
});
