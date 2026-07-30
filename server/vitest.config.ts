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
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      SKIP_DB: '1',
      ALLOWED_ORIGIN: 'http://localhost:8888',
    },
  },
});
