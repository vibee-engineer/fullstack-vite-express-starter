/**
 * localDisk.ts — the default storage driver: files on the local filesystem.
 *
 * Zero infra, works in every environment, and is all most single-container apps
 * ever need. Objects live under `baseDir` (env `UPLOAD_DIR`, default `uploads`).
 * Keys are sanitized to stay inside `baseDir` — a key can never traverse out
 * with `../`, so an attacker-supplied key can't read or clobber a system file.
 */

import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

import type { StorageDriver } from './driver';

export class LocalDiskDriver implements StorageDriver {
  constructor(private readonly baseDir: string) {}

  /** Resolve `key` to an absolute path guaranteed to sit under baseDir. */
  private resolve(key: string): string {
    const root = path.resolve(this.baseDir);
    // Normalize, then strip any leading separators/traversal so join stays put.
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
    const full = path.resolve(root, safe);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error(`Unsafe storage key "${key}".`);
    }
    return full;
  }

  async save(key: string, body: Buffer, _contentType: string): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async getStream(key: string): Promise<Readable> {
    const full = this.resolve(key);
    // Surface a missing file as a rejection here (stat) rather than as an
    // async 'error' event the caller might miss.
    await stat(full);
    return createReadStream(full);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    // force:true makes a missing file a no-op instead of an ENOENT throw.
    await rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    // `prefix` names a directory under baseDir (e.g. "backups"). Walk it and
    // return keys relative to baseDir, using forward slashes to match how keys
    // are written. A missing directory is an empty list, not an error.
    const cleaned = prefix.replace(/\/+$/, '');
    const root = path.resolve(this.baseDir);
    const dir = cleaned ? this.resolve(cleaned) : root;
    try {
      const entries = await readdir(dir, { withFileTypes: true, recursive: true });
      return entries
        .filter((e) => e.isFile())
        .map((e) => {
          const abs = path.join(e.parentPath, e.name);
          return path.relative(root, abs).split(path.sep).join('/');
        });
    } catch {
      // Missing directory → empty list.
      return [];
    }
  }
}
