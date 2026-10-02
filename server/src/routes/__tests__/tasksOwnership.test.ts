/**
 * BOLA / IDOR (OWASP API Security #1): user B must not read, change or delete
 * user A's task by guessing its id. Anonymous callers see shared rows only.
 */

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { createMemoryAuthRepository, setAuthRepository } from '../../repositories/authRepository';
import { createMemoryTaskRepository, setTaskRepository } from '../../repositories/taskRepository';

const app = createApp();
const shared = {
  id: 'shared_1',
  title: 'Seeded shared task',
  description: null,
  status: 'todo' as const,
  ownerId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  setAuthRepository(createMemoryAuthRepository());
  setTaskRepository(createMemoryTaskRepository([shared]));
});
afterEach(() => {
  setAuthRepository(null);
  setTaskRepository(null);
});

async function signedIn(email: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' }).expect(201);
  return agent;
}

describe('task ownership', () => {
  it("another user cannot read, update or delete A's task (404, not 403)", async () => {
    const a = await signedIn('a@example.com');
    const b = await signedIn('b@example.com');
    const { body: task } = await a.post('/api/tasks').send({ title: 'A only' }).expect(201);

    await b.get(`/api/tasks/${task.id}`).expect(404);
    await b.patch(`/api/tasks/${task.id}`).send({ title: 'pwned' }).expect(404);
    await b.delete(`/api/tasks/${task.id}`).expect(404);
    const bList = await b.get('/api/tasks').expect(200);
    expect(bList.body.items.map((t: { id: string }) => t.id)).not.toContain(task.id);

    const still = await a.get(`/api/tasks/${task.id}`).expect(200);
    expect(still.body.title).toBe('A only');
  });

  it('signed-out callers see shared rows only and cannot reach owned ones', async () => {
    const a = await signedIn('a@example.com');
    const { body: task } = await a.post('/api/tasks').send({ title: 'A only' }).expect(201);
    const list = await request(app).get('/api/tasks').expect(200);
    expect(list.body.items.map((t: { id: string }) => t.id)).toEqual(['shared_1']);
    await request(app).get(`/api/tasks/${task.id}`).expect(404);
  });

  it('the owner sees their rows plus shared rows; tasks created signed-out stay shared', async () => {
    const a = await signedIn('a@example.com');
    const { body: mine } = await a.post('/api/tasks').send({ title: 'mine' }).expect(201);
    expect(mine.ownerId).toBeTruthy();
    const { body: anon } = await request(app)
      .post('/api/tasks')
      .send({ title: 'anon' })
      .expect(201);
    expect(anon.ownerId).toBeNull();
    const list = await a.get('/api/tasks').expect(200);
    expect(list.body.total).toBe(3);
  });
});
