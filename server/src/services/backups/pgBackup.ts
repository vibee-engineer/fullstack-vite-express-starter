/**
 * pgBackup.ts — Postgres backup + restore via pg_dump / pg_restore.
 *
 * Dumps go through the SAME storage driver as uploads (services/storage), so
 * setting STORAGE_DRIVER=s3 puts backups OFFSITE with zero extra config — a
 * backup on the app's own disk dies with the container, so S3/R2 is strongly
 * recommended in production.
 *
 * The `pg_dump`/`pg_restore` binaries must be on PATH (they ship in the
 * `postgresql-client` package; the starter's server image installs it). The
 * command RUNNER is injectable so the argv/env construction and the
 * store/prune/restore orchestration are unit-testable without a live database.
 *
 * Mongo note: the same shape applies with mongodump/mongorestore — left as a
 * fast-follow; this module is Postgres-first.
 */

import { spawn } from 'node:child_process';

import { getStorage } from '../storage';
import type { StorageDriver } from '../storage';

/** Parsed Postgres connection parameters. */
export interface PgConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export interface BackupInfo {
  key: string;
  size: number;
  createdAt: string;
}

/** The command surface, injectable for tests. */
export interface BackupRunner {
  /** Run pg_dump with `args` + `env`; resolve its stdout (the dump) as a Buffer. */
  dump(args: string[], env: NodeJS.ProcessEnv): Promise<Buffer>;
  /** Run pg_restore with `args` + `env`, feeding `input` to stdin. */
  restore(args: string[], env: NodeJS.ProcessEnv, input: Buffer): Promise<void>;
}

export interface BackupDeps {
  runner?: BackupRunner;
  storage?: StorageDriver;
  prefix?: string;
  /** Postgres URL; defaults to env.DATABASE_URL at call time. */
  databaseUrl?: string;
  /** Clock seam for the timestamped key. */
  now?: () => Date;
}

/** Parse a `postgres://user:pass@host:port/db` URL into connection params. */
export function parseDatabaseUrl(url: string): PgConnection {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error(`Backups need a Postgres DATABASE_URL, got "${parsed.protocol}".`);
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!database) throw new Error('DATABASE_URL has no database name.');
  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username) || 'postgres',
    password: decodeURIComponent(parsed.password),
    database,
  };
}

/** UTC timestamp safe for a filename: 2026-09-12T02-15-30-123Z. */
function backupTimestamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, '-');
}

const DUMP_SUFFIX = '.dump';

function resolveDeps(deps: BackupDeps) {
  const storage = deps.storage ?? getStorage();
  const prefix = (deps.prefix ?? 'backups').replace(/\/+$/, '');
  const runner = deps.runner ?? defaultRunner;
  const now = deps.now ?? (() => new Date());
  return { storage, prefix, runner, now };
}

function connectionArgs(conn: PgConnection): string[] {
  return ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database];
}

function connectionEnv(conn: PgConnection): NodeJS.ProcessEnv {
  // PGPASSWORD keeps the secret off the argv (which is visible in `ps`).
  return { ...process.env, PGPASSWORD: conn.password };
}

/**
 * Create a compressed (`-Fc`) dump and store it under `<prefix>/backup-<ts>.dump`.
 * Returns the stored key + size.
 */
export async function createBackup(deps: BackupDeps = {}): Promise<BackupInfo> {
  const { storage, prefix, runner, now } = resolveDeps(deps);
  const conn = parseDatabaseUrl(deps.databaseUrl ?? requireDatabaseUrl());
  const when = now();
  const key = `${prefix}/backup-${backupTimestamp(when)}${DUMP_SUFFIX}`;

  const args = ['-Fc', '--no-owner', '--no-privileges', ...connectionArgs(conn)];
  const dump = await runner.dump(args, connectionEnv(conn));
  await storage.save(key, dump, 'application/octet-stream');

  return { key, size: dump.length, createdAt: when.toISOString() };
}

/**
 * Restore a stored dump. DESTRUCTIVE: `--clean --if-exists` drops existing
 * objects first, so the target database ends up matching the dump.
 */
export async function restoreBackup(key: string, deps: BackupDeps = {}): Promise<void> {
  const { storage, runner } = resolveDeps(deps);
  const conn = parseDatabaseUrl(deps.databaseUrl ?? requireDatabaseUrl());

  const input = await storage.read(key);
  const args = ['--no-owner', '--no-privileges', '--clean', '--if-exists', ...connectionArgs(conn)];
  await runner.restore(args, connectionEnv(conn), input);
}

/** List stored backup keys, newest first (the timestamp sorts lexically). */
export async function listBackups(deps: BackupDeps = {}): Promise<string[]> {
  const { storage, prefix } = resolveDeps(deps);
  const keys = await storage.list(prefix);
  return keys
    .filter((k) => k.includes('/backup-') && k.endsWith(DUMP_SUFFIX))
    .sort()
    .reverse();
}

/** Keep the `keep` newest backups, delete the rest. Returns deleted keys. */
export async function pruneBackups(keep: number, deps: BackupDeps = {}): Promise<string[]> {
  const { storage } = resolveDeps(deps);
  const all = await listBackups(deps);
  const doomed = all.slice(Math.max(0, keep));
  for (const key of doomed) await storage.delete(key);
  return doomed;
}

function requireDatabaseUrl(): string {
  // Lazy import so the module loads under SKIP_DB (tests pass databaseUrl).
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Backups require DATABASE_URL (Postgres).');
  return url;
}

// ---------------------------------------------------------------------------
// Default runner — real child processes
// ---------------------------------------------------------------------------

function run(command: string, args: string[], env: NodeJS.ProcessEnv, input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => err.push(d));
    child.on('error', (e) =>
      reject(new Error(`Failed to run ${command} (is it on PATH?): ${e.message}`)),
    );
    child.on('close', (code) => {
      if (code === 0) return resolve(Buffer.concat(out));
      reject(new Error(`${command} exited ${code}: ${Buffer.concat(err).toString().slice(0, 500)}`));
    });
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

export const defaultRunner: BackupRunner = {
  dump: (args, env) => run('pg_dump', args, env),
  restore: async (args, env, input) => {
    await run('pg_restore', args, env, input);
  },
};
