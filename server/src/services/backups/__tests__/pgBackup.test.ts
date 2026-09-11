/**
 * pgBackup.test.ts — the backup orchestration with an injected command runner
 * (no pg_dump binary, no database) and a real LocalDiskDriver temp store.
 * Verifies argv/env construction, key format, store/restore, list + retention.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalDiskDriver } from '../../storage';
import {
  createBackup,
  listBackups,
  parseDatabaseUrl,
  pruneBackups,
  restoreBackup,
  type BackupRunner,
} from '../pgBackup';

const DB_URL = 'postgresql://alice:s3cr3t@db.example.com:5433/appdb?schema=public';

let dir: string;
let storage: LocalDiskDriver;

/** Records every dump/restore call and returns a canned dump buffer. */
function recordingRunner() {
  const calls: {
    kind: 'dump' | 'restore';
    args: string[];
    env: NodeJS.ProcessEnv;
    input?: Buffer;
  }[] = [];
  const runner: BackupRunner = {
    async dump(args, env) {
      calls.push({ kind: 'dump', args, env });
      return Buffer.from('PGDMP-fake-dump');
    },
    async restore(args, env, input) {
      calls.push({ kind: 'restore', args, env, input });
    },
  };
  return { runner, calls };
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'backups-'));
  storage = new LocalDiskDriver(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('parseDatabaseUrl', () => {
  it('parses host, port, user, password, database', () => {
    expect(parseDatabaseUrl(DB_URL)).toEqual({
      host: 'db.example.com',
      port: '5433',
      user: 'alice',
      password: 's3cr3t',
      database: 'appdb',
    });
  });

  it('defaults the port to 5432 and url-decodes credentials', () => {
    const conn = parseDatabaseUrl('postgres://p%40ss:pw%3A1@localhost/mydb');
    expect(conn.host).toBe('localhost');
    expect(conn.port).toBe('5432'); // omitted → default
    expect(conn.user).toBe('p@ss');
    expect(conn.password).toBe('pw:1');
    expect(conn.database).toBe('mydb');
  });

  it('rejects a non-postgres URL and a URL with no database', () => {
    expect(() => parseDatabaseUrl('mysql://x@h/db')).toThrow(/Postgres/);
    expect(() => parseDatabaseUrl('postgres://x@h/')).toThrow(/database name/);
    expect(() => parseDatabaseUrl('not a url')).toThrow(/valid URL/);
  });
});

describe('createBackup', () => {
  it('runs pg_dump with the right args + PGPASSWORD, and stores the dump', async () => {
    const { runner, calls } = recordingRunner();
    const now = () => new Date('2026-09-12T02:15:30.123Z');

    const info = await createBackup({ runner, storage, databaseUrl: DB_URL, now });

    // Key format: <prefix>/backup-<safe-iso>.dump
    expect(info.key).toBe('backups/backup-2026-09-12T02-15-30-123Z.dump');
    expect(info.size).toBe(Buffer.from('PGDMP-fake-dump').length);
    expect(info.createdAt).toBe('2026-09-12T02:15:30.123Z');

    const dump = calls[0]!;
    expect(dump.kind).toBe('dump');
    expect(dump.args).toEqual([
      '-Fc',
      '--no-owner',
      '--no-privileges',
      '-h',
      'db.example.com',
      '-p',
      '5433',
      '-U',
      'alice',
      '-d',
      'appdb',
    ]);
    expect(dump.env.PGPASSWORD).toBe('s3cr3t');

    // The bytes actually landed in storage.
    expect((await storage.read(info.key)).toString()).toBe('PGDMP-fake-dump');
  });

  it('honors a custom prefix', async () => {
    const { runner } = recordingRunner();
    const info = await createBackup({ runner, storage, databaseUrl: DB_URL, prefix: 'db-dumps' });
    expect(info.key.startsWith('db-dumps/backup-')).toBe(true);
  });
});

describe('restoreBackup', () => {
  it('feeds the stored dump to pg_restore with --clean --if-exists', async () => {
    const { runner, calls } = recordingRunner();
    const info = await createBackup({ runner, storage, databaseUrl: DB_URL });

    await restoreBackup(info.key, { runner, storage, databaseUrl: DB_URL });

    const restore = calls.find((c) => c.kind === 'restore')!;
    expect(restore.args).toEqual([
      '--no-owner',
      '--no-privileges',
      '--clean',
      '--if-exists',
      '-h',
      'db.example.com',
      '-p',
      '5433',
      '-U',
      'alice',
      '-d',
      'appdb',
    ]);
    expect(restore.env.PGPASSWORD).toBe('s3cr3t');
    expect(restore.input?.toString()).toBe('PGDMP-fake-dump');
  });
});

describe('listBackups', () => {
  it('lists only backup dumps, newest first', async () => {
    // Write three backups at increasing timestamps + an unrelated file.
    for (const ts of [
      '2026-01-01T00-00-00-000Z',
      '2026-06-01T00-00-00-000Z',
      '2026-03-01T00-00-00-000Z',
    ]) {
      await storage.save(`backups/backup-${ts}.dump`, Buffer.from('x'), 'application/octet-stream');
    }
    await storage.save('backups/readme.txt', Buffer.from('not a backup'), 'text/plain');

    const list = await listBackups({ storage, prefix: 'backups' });
    expect(list).toEqual([
      'backups/backup-2026-06-01T00-00-00-000Z.dump',
      'backups/backup-2026-03-01T00-00-00-000Z.dump',
      'backups/backup-2026-01-01T00-00-00-000Z.dump',
    ]);
  });
});

describe('pruneBackups', () => {
  async function seed(n: number): Promise<void> {
    for (let i = 1; i <= n; i += 1) {
      const ts = `2026-01-${String(i).padStart(2, '0')}T00-00-00-000Z`;
      await storage.save(`backups/backup-${ts}.dump`, Buffer.from('x'), 'application/octet-stream');
    }
  }

  it('keeps the N newest and deletes the rest', async () => {
    await seed(5);
    const deleted = await pruneBackups(2, { storage, prefix: 'backups' });
    expect(deleted).toHaveLength(3);
    // Oldest three are gone; newest two remain.
    const remaining = await listBackups({ storage, prefix: 'backups' });
    expect(remaining).toEqual([
      'backups/backup-2026-01-05T00-00-00-000Z.dump',
      'backups/backup-2026-01-04T00-00-00-000Z.dump',
    ]);
  });

  it('deletes nothing when under the retention count', async () => {
    await seed(2);
    expect(await pruneBackups(7, { storage, prefix: 'backups' })).toEqual([]);
    expect(await listBackups({ storage, prefix: 'backups' })).toHaveLength(2);
  });
});
