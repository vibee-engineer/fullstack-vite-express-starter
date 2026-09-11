/**
 * filesUploadLimit.test.ts — the multer size cap.
 *
 * The cap is read from `env.MAX_UPLOAD_BYTES` when the upload middleware module
 * first loads, so this test sets a tiny limit BEFORE importing the app (hence
 * dynamic imports after the env override) and asserts the 413.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Must run before env.ts is imported by the app graph below.
process.env.MAX_UPLOAD_BYTES = '64';

const { createApp } = await import('../../app');
const { setFileRepository, createMemoryFileRepository } =
  await import('../../repositories/fileRepository');
const { setStorage, LocalDiskDriver } = await import('../../services/storage');

const app = createApp();
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'files-limit-'));
  setFileRepository(createMemoryFileRepository());
  setStorage(new LocalDiskDriver(dir));
});

afterAll(async () => {
  setFileRepository(null);
  setStorage(null);
  await rm(dir, { recursive: true, force: true });
});

describe('upload size limit', () => {
  it('accepts a file under the limit', async () => {
    await request(app)
      .post('/api/files')
      .attach('file', Buffer.alloc(32, 1), 'small.bin')
      .expect(201);
  });

  it('413s FILE_TOO_LARGE for a file over the limit', async () => {
    const res = await request(app)
      .post('/api/files')
      .attach('file', Buffer.alloc(256, 1), 'big.bin')
      .expect(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });
});
