import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Server test runner. Node environment, no DB: `SKIP_DB=1` satisfies env.ts's
 * "one connection string required" refine, and route tests mock the repository
 * anyway, so nothing here needs Postgres or Mongo running.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared': path.resolve(import.meta.dirname, '../shared/src'),
    },
  },
  test: {
    environment: 'node',
    // `mongoose/` is included alongside `src/` deliberately. It used to be
    // src-only, which meant the Mongo model files were typechecked (they are in
    // tsconfig's `include`) but never executed by a test. A CJS/ESM import bug
    // in mongoose/models/Task.ts therefore broke every request on the Mongo
    // stack while the suite stayed fully green.
    include: ['src/**/*.test.ts', 'mongoose/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      SKIP_DB: '1',
      ALLOWED_ORIGIN: 'http://localhost:8888',
    },
  },
});
