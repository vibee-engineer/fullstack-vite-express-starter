/**
 * s3.ts — S3 / R2 / any S3-compatible bucket.
 *
 * The AWS SDK is NOT a base dependency: pulling `@aws-sdk/client-s3` into every
 * per-customer image would bloat installs for the majority of apps that upload
 * to local disk. It is loaded lazily, by a non-literal specifier so TypeScript
 * doesn't resolve it at build time, and is only reached when STORAGE_DRIVER=s3.
 *
 * To use S3/R2: `npm i @aws-sdk/client-s3 -w server`, then set STORAGE_DRIVER=s3
 * plus S3_BUCKET / S3_REGION (and S3_ENDPOINT for R2/MinIO). Credentials come
 * from the standard AWS provider chain (env vars, instance role, ...).
 */

import type { Readable } from 'node:stream';

import type { StorageDriver } from './driver';

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string | undefined;
}

// Loaded lazily. `any` is deliberate — the SDK's types aren't installed in the
// base image, and this file must typecheck without them.
/* eslint-disable @typescript-eslint/no-explicit-any */
type S3Module = any;

async function loadSdk(): Promise<S3Module> {
  const moduleName = '@aws-sdk/client-s3';
  try {
    return (await import(moduleName)) as S3Module;
  } catch {
    throw new Error(
      'STORAGE_DRIVER=s3 but @aws-sdk/client-s3 is not installed. ' +
        'Run `npm i @aws-sdk/client-s3 -w server`.',
    );
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class S3Driver implements StorageDriver {
  private clientPromise: Promise<{ client: any; commands: S3Module }> | null = null;

  constructor(private readonly config: S3Config) {}

  private sdk(): Promise<{ client: any; commands: S3Module }> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const mod = await loadSdk();
        const client = new mod.S3Client({
          region: this.config.region,
          ...(this.config.endpoint ? { endpoint: this.config.endpoint, forcePathStyle: true } : {}),
        });
        return { client, commands: mod };
      })();
    }
    return this.clientPromise;
  }

  async save(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, commands } = await this.sdk();
    await client.send(
      new commands.PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getStream(key: string): Promise<Readable> {
    const { client, commands } = await this.sdk();
    const res = await client.send(
      new commands.GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    return res.Body as Readable;
  }

  async read(key: string): Promise<Buffer> {
    return streamToBuffer(await this.getStream(key));
  }

  async delete(key: string): Promise<void> {
    const { client, commands } = await this.sdk();
    await client.send(
      new commands.DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    const { client, commands } = await this.sdk();
    try {
      await client.send(new commands.HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      const name = (err as { name?: string })?.name;
      if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') return false;
      throw err;
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
