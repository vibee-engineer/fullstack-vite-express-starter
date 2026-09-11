/**
 * files.test.ts — the upload/download/delete flow end-to-end via supertest,
 * backed by a REAL LocalDiskDriver (temp dir) + the in-memory file repository.
 * Exercises the full path: multipart parse → blob write → row → download → delete.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { setFileRepository, createMemoryFileRepository } from '../../repositories/fileRepository';
import { LocalDiskDriver } from '../../services/storage';
import { setStorage } from '../../services/storage';

const app = createApp();
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'files-route-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

beforeEach(() => {
  setFileRepository(createMemoryFileRepository());
  setStorage(new LocalDiskDriver(dir));
});

afterEach(() => {
  setFileRepository(null);
  setStorage(null);
});

const PNG = Buffer.from('\x89PNG\r\n\x1a\n fake png bytes', 'binary');

/**
 * superagent parser that preserves a binary response body as a Buffer. The
 * parse callback receives the raw response stream, so it is typed loosely.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function binaryParser(res: any, cb: (err: Error | null, body: Buffer) => void): void {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk: string) => {
    data += chunk;
  });
  res.on('end', () => cb(null, Buffer.from(data, 'binary')));
}

describe('POST /api/files', () => {
  it('uploads a file and returns 201 FileMeta (no storageKey leaked)', async () => {
    const res = await request(app)
      .post('/api/files')
      .attach('file', PNG, 'photo.png')
      .expect(201);

    expect(res.body).toMatchObject({
      filename: 'photo.png',
      contentType: 'image/png',
      size: PNG.length,
    });
    expect(res.body.id).toBeTruthy();
    expect(res.body.url).toBe(`/api/files/${res.body.id}`);
    expect(res.body).not.toHaveProperty('storageKey');
  });

  it('400s NO_FILE when the form has no file part', async () => {
    const res = await request(app).post('/api/files').field('notafile', 'x').expect(400);
    expect(res.body.error.code).toBe('NO_FILE');
  });

  it('sanitizes a path-y filename down to its basename', async () => {
    const res = await request(app)
      .post('/api/files')
      .attach('file', PNG, '../../etc/evil.png')
      .expect(201);
    expect(res.body.filename).toBe('evil.png');
  });
});

describe('GET /api/files/:id (download)', () => {
  it('streams back the exact bytes with the right content type', async () => {
    const up = await request(app).post('/api/files').attach('file', PNG, 'photo.png').expect(201);

    const res = await request(app)
      .get(`/api/files/${up.body.id}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['content-length']).toBe(String(PNG.length));
    expect(res.headers['content-disposition']).toContain('photo.png');
    expect(res.body).toEqual(PNG);
  });

  it('404s FILE_NOT_FOUND for an unknown id', async () => {
    const res = await request(app).get('/api/files/nope').expect(404);
    expect(res.body.error.code).toBe('FILE_NOT_FOUND');
  });

  it('404s FILE_CONTENTS_MISSING when the row exists but the blob is gone', async () => {
    const up = await request(app).post('/api/files').attach('file', PNG, 'photo.png').expect(201);
    // Wipe the blob out from under the row; the next upload re-creates the dir.
    await rm(dir, { recursive: true, force: true });
    const res = await request(app).get(`/api/files/${up.body.id}`).expect(404);
    expect(res.body.error.code).toBe('FILE_CONTENTS_MISSING');
  });
});

describe('GET /api/files/:id/meta', () => {
  it('returns metadata as JSON', async () => {
    const up = await request(app).post('/api/files').attach('file', PNG, 'photo.png').expect(201);
    const res = await request(app).get(`/api/files/${up.body.id}/meta`).expect(200);
    expect(res.body).toMatchObject({ id: up.body.id, filename: 'photo.png', size: PNG.length });
  });

  it('404s for an unknown id', async () => {
    await request(app).get('/api/files/nope/meta').expect(404);
  });
});

describe('GET /api/files (list)', () => {
  it('lists newest first with a total', async () => {
    await request(app).post('/api/files').attach('file', PNG, 'a.png').expect(201);
    await request(app).post('/api/files').attach('file', PNG, 'b.png').expect(201);

    const res = await request(app).get('/api/files').expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].filename).toBe('b.png'); // newest first
    expect(res.body.items[0]).not.toHaveProperty('storageKey');
  });

  it('400s on an out-of-range limit', async () => {
    const res = await request(app).get('/api/files?limit=9999').expect(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});

describe('DELETE /api/files/:id', () => {
  it('deletes the row and the blob, then 404s on re-fetch', async () => {
    const up = await request(app).post('/api/files').attach('file', PNG, 'photo.png').expect(201);

    await request(app).delete(`/api/files/${up.body.id}`).expect(204);
    await request(app).get(`/api/files/${up.body.id}`).expect(404);
    await request(app).get(`/api/files/${up.body.id}/meta`).expect(404);
  });

  it('404s deleting an unknown id', async () => {
    const res = await request(app).delete('/api/files/nope').expect(404);
    expect(res.body.error.code).toBe('FILE_NOT_FOUND');
  });
});
