/**
 * localDisk.test.ts — the default storage driver against a real temp dir.
 */

import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalDiskDriver } from '../localDisk';

let dir: string;
let driver: LocalDiskDriver;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'storage-'));
  driver = new LocalDiskDriver(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Collect a Readable into a Buffer. */
async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

describe('LocalDiskDriver', () => {
  it('saves and reads back the exact bytes', async () => {
    const body = Buffer.from('hello world');
    await driver.save('a.txt', body, 'text/plain');
    expect(await driver.read('a.txt')).toEqual(body);
  });

  it('streams the bytes via getStream', async () => {
    const body = Buffer.from('streamed content');
    await driver.save('s.bin', body, 'application/octet-stream');
    const stream = await driver.getStream('s.bin');
    expect(await drain(stream)).toEqual(body);
  });

  it('reports existence correctly', async () => {
    expect(await driver.exists('nope')).toBe(false);
    await driver.save('yes', Buffer.from('x'), 'text/plain');
    expect(await driver.exists('yes')).toBe(true);
  });

  it('overwrites an existing key', async () => {
    await driver.save('k', Buffer.from('first'), 'text/plain');
    await driver.save('k', Buffer.from('second'), 'text/plain');
    expect((await driver.read('k')).toString()).toBe('second');
  });

  it('deletes, and delete is idempotent for a missing key', async () => {
    await driver.save('d', Buffer.from('x'), 'text/plain');
    await driver.delete('d');
    expect(await driver.exists('d')).toBe(false);
    await expect(driver.delete('d')).resolves.toBeUndefined(); // no throw
    await expect(driver.delete('never-existed')).resolves.toBeUndefined();
  });

  it('getStream rejects for a missing key', async () => {
    await expect(driver.getStream('ghost')).rejects.toBeTruthy();
  });

  it('creates nested key directories on save', async () => {
    await driver.save('nested/deep/file.txt', Buffer.from('x'), 'text/plain');
    expect(await driver.exists('nested/deep/file.txt')).toBe(true);
  });

  it('lists keys under a prefix (forward-slashed, recursive)', async () => {
    await driver.save('backups/backup-1.dump', Buffer.from('a'), 'application/octet-stream');
    await driver.save('backups/backup-2.dump', Buffer.from('b'), 'application/octet-stream');
    await driver.save('other/x.txt', Buffer.from('c'), 'text/plain');

    const keys = (await driver.list('backups')).sort();
    expect(keys).toEqual(['backups/backup-1.dump', 'backups/backup-2.dump']);
  });

  it('list returns an empty array for a missing prefix', async () => {
    expect(await driver.list('does-not-exist')).toEqual([]);
  });

  it('refuses path-traversal keys (cannot escape baseDir)', async () => {
    await expect(
      driver.save('../escape.txt', Buffer.from('x'), 'text/plain'),
    ).resolves.toBeUndefined();
    // The traversal was stripped, so the file landed INSIDE dir, not above it.
    const parent = path.dirname(dir);
    await expect(stat(path.join(parent, 'escape.txt'))).rejects.toBeTruthy();
    // A blatant absolute-escape attempt also stays contained.
    await expect(
      driver.save('../../../../../../tmp/pwned-storage-test', Buffer.from('x'), 'text/plain'),
    ).resolves.toBeUndefined();
    await expect(stat('/tmp/pwned-storage-test')).rejects.toBeTruthy();
  });
});
