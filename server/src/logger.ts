import pino from 'pino';

import { env } from './env';

/**
 * pino instance. Pretty transport in dev for readable logs; structured JSON
 * in prod so log aggregators (Datadog, Loki, ...) can parse fields.
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
    : { level: 'info' },
);
