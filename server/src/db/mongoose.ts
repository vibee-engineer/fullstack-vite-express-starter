import mongoose from 'mongoose';

import { env } from '../env';
import { logger } from '../logger';

/**
 * Connect to Mongo. Called from index.ts before app.listen() when
 * MONGO_URL is set (isMongo === true).
 */
export async function connectMongo(): Promise<void> {
  if (!env.MONGO_URL) {
    throw new Error('connectMongo() called without MONGO_URL set.');
  }
  await mongoose.connect(env.MONGO_URL);
  logger.info({ url: env.MONGO_URL }, 'mongo connected');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
