/**
 * Regression tests for defects found in the 2026-10-02 starter audit.
 * Each test fails on the unfixed starter.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { createMemoryAuthRepository, setAuthRepository } from '../../repositories/authRepository';
import { createMemoryFileRepository, setFileRepository } from '../../repositories/fileRepository';
import { createMemoryTaskRepository, setTaskRepository } from '../../repositories/taskRepository';
import { LocalDiskDriver, setStorage } from '../../services/storage';

const app = createApp();
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'audit-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
beforeEach(() => {
  setAuthRepository(createMemoryAuthRepository());
  setFileRepository(createMemoryFileRepository());
  setTaskRepository(createMemoryTaskRepository());
  setStorage(new LocalDiskDriver(dir));
});
afterEach(() => {
  setAuthRepository(null);
  setFileRepository(null);
  setTaskRepository(null);
  setStorage(null);
});

describe('register roles', () => {
  it('only the FIRST registrant is owner; later self-registrations are staff', async () => {
    const first = await request(app)
      .post('/api/auth/register')
      .send({ email: 'boss@example.com', password: 'password123' });
    const second = await request(app)
      .post('/api/auth/register')
      .send({ email: 'stranger@example.com', password: 'password123' });
    expect(first.body.user.role).toBe('owner');
    expect(second.body.user.role).toBe('staff');
  });
  it('a seeded profile with no password does not take the owner role from the creator', async () => {
    const repo = createMemoryAuthRepository();
    setAuthRepository(repo);
    // prisma/seed.ts upserts demo@example.com with no passwordHash.
    await repo.createUser({
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash: null as unknown as string,
      role: 'staff',
    });
    const creator = await request(app)
      .post('/api/auth/register')
      .send({ email: 'creator@example.com', password: 'password123' });
    expect(creator.body.user.role).toBe('owner');
  });
});

describe('file download hardening', () => {
  it('does not serve an uploaded text/html file as an active same-origin document', async () => {
    const up = await request(app)
      .post('/api/files')
      .attach('file', Buffer.from('<script>alert(document.domain)</script>'), {
        filename: 'x.html',
        contentType: 'text/html',
      });
    expect(up.status).toBe(201);
    const res = await request(app).get(`/api/files/${up.body.id}`);
    expect(res.status).toBe(200);
    const csp = String(res.headers['content-security-policy'] ?? '');
    const disposition = String(res.headers['content-disposition'] ?? '');
    // Either sandboxed or forced to download — never a live HTML page on the app origin.
    expect(csp.includes('sandbox') || disposition.startsWith('attachment')).toBe(true);
  });

  it('downloads a file whose name is outside Latin-1 (RFC 5987 upload) instead of 500ing', async () => {
    const up = await request(app).post('/api/files').attach('file', Buffer.from('hello'), {
      filename: '报价单.pdf',
      contentType: 'application/pdf',
    });
    expect(up.status).toBe(201);
    expect(up.body.filename).toBe('报价单.pdf'); // not latin1 mojibake
    const res = await request(app).get(`/api/files/${up.body.id}`);
    expect(res.status).toBe(200);
  });
});

describe('task list pagination', () => {
  it('can reach rows beyond the first page', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/tasks')
        .send({ title: `t${i}` });
    }
    const page1 = await request(app).get('/api/tasks?limit=2');
    expect(page1.body.total).toBe(5);
    const seen = new Set<string>(page1.body.items.map((t: { id: string }) => t.id));
    let cursor: string | null | undefined = page1.body.nextCursor;
    while (cursor) {
      const next = await request(app).get(
        `/api/tasks?limit=2&cursor=${encodeURIComponent(cursor)}`,
      );
      expect(next.status).toBe(200);
      for (const t of next.body.items) seen.add(t.id);
      cursor = next.body.nextCursor;
    }
    expect(seen.size).toBe(5);
  });
});

describe('file list pagination', () => {
  it('can reach files beyond the first page (cursor was accepted but ignored)', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/files')
        .attach('file', Buffer.from(`f${i}`), { filename: `f${i}.txt`, contentType: 'text/plain' });
    }
    const page1 = await request(app).get('/api/files?limit=2');
    expect(page1.body.total).toBe(5);
    const seen = new Set<string>(page1.body.items.map((f: { id: string }) => f.id));
    let cursor: string | null | undefined = page1.body.nextCursor;
    let pages = 1;
    while (cursor && pages < 10) {
      const next = await request(app).get(
        `/api/files?limit=2&cursor=${encodeURIComponent(cursor)}`,
      );
      expect(next.status).toBe(200);
      for (const f of next.body.items) seen.add(f.id);
      cursor = next.body.nextCursor;
      pages += 1;
    }
    expect(seen.size).toBe(5);
  });
});

describe('error envelope', () => {
  it('malformed JSON is a 400 with a code, like every other error', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('content-type', 'application/json')
      .send('{"title":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
