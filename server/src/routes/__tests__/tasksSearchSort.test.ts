/** Server-driven list: search (?q=), whitelisted sort (?sort=&dir=), cursor paging under any order. */

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { createMemoryTaskRepository, setTaskRepository } from '../../repositories/taskRepository';

const app = createApp();
const row = (id: string, title: string, day: number, description: string | null = null) => ({
  id,
  title,
  description,
  status: 'todo' as const,
  ownerId: null,
  createdAt: `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`,
  updatedAt: `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`,
});

beforeEach(() => {
  setTaskRepository(
    createMemoryTaskRepository([
      row('t1', 'Order flour', 1, 'From the Mill Street supplier'),
      row('t2', 'call plumber', 2),
      row('t3', 'Bake sourdough', 3, 'Needs FLOUR and starter'),
      row('t4', 'Answer email', 4),
      row('t5', 'Book delivery', 5),
    ]),
  );
});
afterEach(() => setTaskRepository(null));

const ids = (res: request.Response) => res.body.items.map((t: { id: string }) => t.id);

describe('GET /api/tasks search + sort', () => {
  it('?q= matches title or description, case-insensitively', async () => {
    const res = await request(app).get('/api/tasks?q=flour').expect(200);
    expect(ids(res).sort()).toEqual(['t1', 't3']);
    expect(res.body.total).toBe(2);
  });

  it('a blank ?q= is no search', async () => {
    const res = await request(app).get('/api/tasks?q=%20%20').expect(200);
    expect(res.body.total).toBe(5);
  });

  it('?sort=title&dir=asc orders by title, case-insensitively', async () => {
    const res = await request(app).get('/api/tasks?sort=title&dir=asc').expect(200);
    expect(ids(res)).toEqual(['t4', 't3', 't5', 't2', 't1']);
  });

  it('rejects a sort column outside the whitelist', async () => {
    await request(app).get('/api/tasks?sort=passwordHash').expect(400);
  });

  it('cursor pages walk the whole list under a non-default sort with no repeats', async () => {
    const seen: string[] = [];
    let url = '/api/tasks?sort=title&dir=desc&limit=2';
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get(url).expect(200);
      seen.push(...ids(res));
      if (!res.body.nextCursor) break;
      url = `/api/tasks?sort=title&dir=desc&limit=2&cursor=${res.body.nextCursor}`;
    }
    expect(seen).toEqual(['t1', 't2', 't5', 't3', 't4']);
  });
});
