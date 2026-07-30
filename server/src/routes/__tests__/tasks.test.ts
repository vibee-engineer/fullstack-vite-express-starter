/**
 * tasks.test.ts — THE REFERENCE ROUTE TEST. Copy this file per resource.
 *
 * Integration-level: real Express app via `createApp()`, real middleware chain
 * (validate → asyncHandler → error), driven with supertest. The only seam is
 * the repository, mocked with `vi.hoisted` so no database is involved.
 *
 * What every resource's route test must cover:
 *   - the happy path of each verb, including the status code (201/204 matter)
 *   - 400 + `code: 'VALIDATION'` on a bad payload
 *   - 404 + the resource's own error code on a missing id
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@shared/types';

// `vi.mock` factories are hoisted above imports, so the stub must be created
// with `vi.hoisted` — a plain `const` would still be in its TDZ when the
// factory runs.
const { repo } = vi.hoisted(() => ({
  repo: {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../repositories/taskRepository', () => ({
  getTaskRepository: () => repo,
}));

// Safe as a static import: vitest hoists `vi.mock` above every import, so
// app.ts's transitive `taskRepository` import resolves to the stub.
const { createApp } = await import('../../app');
const app = createApp();

const TASK: Task = {
  id: 'task_1',
  title: 'Write the route test',
  description: null,
  status: 'todo',
  createdAt: '2026-07-31T00:00:00.000Z',
  updatedAt: '2026-07-31T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/tasks', () => {
  it('returns the list envelope', async () => {
    repo.list.mockResolvedValue({ items: [TASK], total: 1 });

    const res = await request(app).get('/api/tasks').expect(200);

    expect(res.body).toEqual({ items: [TASK], total: 1 });
  });

  it('applies the schema default for limit and passes the status filter through', async () => {
    repo.list.mockResolvedValue({ items: [], total: 0 });

    await request(app).get('/api/tasks?status=done').expect(200);

    expect(repo.list).toHaveBeenCalledWith({ status: 'done', limit: 50 });
  });

  it('rejects an unknown status with 400 VALIDATION', async () => {
    const res = await request(app).get('/api/tasks?status=nope').expect(400);

    expect(res.body.error.code).toBe('VALIDATION');
    expect(repo.list).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range limit with 400 VALIDATION', async () => {
    const res = await request(app).get('/api/tasks?limit=9999').expect(400);

    expect(res.body.error.code).toBe('VALIDATION');
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns the task', async () => {
    repo.findById.mockResolvedValue(TASK);

    const res = await request(app).get('/api/tasks/task_1').expect(200);

    expect(res.body).toEqual(TASK);
    expect(repo.findById).toHaveBeenCalledWith('task_1');
  });

  it('404s with TASK_NOT_FOUND when the repository returns null', async () => {
    repo.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/tasks/missing').expect(404);

    expect(res.body.error).toMatchObject({ code: 'TASK_NOT_FOUND' });
    expect(res.body.error.message).toContain('missing');
  });
});

describe('POST /api/tasks', () => {
  it('creates and returns 201', async () => {
    repo.create.mockResolvedValue(TASK);

    const res = await request(app)
      .post('/api/tasks')
      .send({ title: '  Write the route test  ' })
      .expect(201);

    expect(res.body).toEqual(TASK);
    // zod `.trim()` runs before the handler sees the body.
    expect(repo.create).toHaveBeenCalledWith({ title: 'Write the route test' });
  });

  it('rejects an empty title with 400 VALIDATION and zod details', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '   ' }).expect(400);

    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.details.fieldErrors.title).toBeDefined();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown status with 400 VALIDATION', async () => {
    await request(app).post('/api/tasks').send({ title: 'ok', status: 'shipped' }).expect(400);

    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('updates and returns the task', async () => {
    const updated = { ...TASK, status: 'done' as const };
    repo.update.mockResolvedValue(updated);

    const res = await request(app).patch('/api/tasks/task_1').send({ status: 'done' }).expect(200);

    expect(res.body).toEqual(updated);
    expect(repo.update).toHaveBeenCalledWith('task_1', { status: 'done' });
  });

  it('rejects an empty patch with 400 VALIDATION', async () => {
    const res = await request(app).patch('/api/tasks/task_1').send({}).expect(400);

    expect(res.body.error.code).toBe('VALIDATION');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('404s when the task does not exist', async () => {
    repo.update.mockResolvedValue(null);

    const res = await request(app).patch('/api/tasks/missing').send({ title: 'x' }).expect(404);

    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('returns 204 with no body', async () => {
    repo.remove.mockResolvedValue(true);

    const res = await request(app).delete('/api/tasks/task_1').expect(204);

    expect(res.body).toEqual({});
    expect(repo.remove).toHaveBeenCalledWith('task_1');
  });

  it('404s when nothing was deleted', async () => {
    repo.remove.mockResolvedValue(false);

    const res = await request(app).delete('/api/tasks/missing').expect(404);

    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });
});

describe('error envelope', () => {
  it('normalizes a thrown repository error to { error: { message, code } }', async () => {
    repo.list.mockRejectedValue(new Error('connection reset'));

    const res = await request(app).get('/api/tasks').expect(500);

    expect(res.body.error.message).toBe('connection reset');
  });

  it('404s unknown /api routes with NOT_FOUND', async () => {
    const res = await request(app).get('/api/nope').expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
