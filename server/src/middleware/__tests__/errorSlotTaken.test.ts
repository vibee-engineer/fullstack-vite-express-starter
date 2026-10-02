/**
 * A double booking must reach the client as 409 SLOT_TAKEN, not a 500.
 * Postgres raises 23P01 when an EXCLUDE constraint (see
 * services/booking noOverlapConstraintSql) rejects an overlapping row; a route
 * that forgets to catch it should still give the user a "pick another time".
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { errorMiddleware } from '../error';

function appThrowing(err: unknown) {
  const app = express();
  app.post('/book', (_req, _res, next) => next(err));
  app.use(errorMiddleware);
  return app;
}

describe('errorMiddleware: exclusion violations', () => {
  it('maps a Prisma P2010 carrying 23P01 to 409 SLOT_TAKEN', async () => {
    const err = Object.assign(new Error('Raw query failed. Code: `23P01`.'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '23P01', kind: 'postgres' } } },
    });
    const res = await request(appThrowing(err)).post('/book');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');
    expect(res.body.error.message).not.toMatch(/23P01|Raw query/);
  });

  it('leaves other errors alone', async () => {
    const res = await request(
      appThrowing(Object.assign(new Error('nope'), { status: 404, code: 'NOT_FOUND' })),
    ).post('/book');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
