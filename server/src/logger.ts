import pino from 'pino';

import { env } from './env';

/**
 * pino instance. Pretty transport in dev for readable logs; structured JSON
 * in prod so log aggregators (Datadog, Loki, ...) can parse fields; silent
 * under `NODE_ENV=test` so `vitest run` output stays readable.
 */
export const logger = pino(
  env.NODE_ENV === 'development'
    ? {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : { level: env.NODE_ENV === 'test' ? 'silent' : 'info' },
);
