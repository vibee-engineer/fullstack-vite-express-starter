/**
 * Loads every module that is NOT reachable from the vitest suite, under the
 * REAL Node ESM loader (tsx) — the same loader that runs the server in dev and
 * prod. Exits non-zero on the first failure.
 *
 * Why a standalone script instead of a test:
 *
 * vitest runs modules through Vite's transform pipeline, and Vite's CJS interop
 * synthesizes named exports for CommonJS packages that Node's native ESM loader
 * refuses to. So `import { models } from 'mongoose'` PASSES under vitest and
 * THROWS under tsx:
 *
 *   The requested module 'mongoose' does not provide an export named 'models'
 *
 * That is not a hypothetical. It shipped, and the symptom was maximally
 * misleading: /api/health returned 200, the boot log said "mongo connected",
 * the typecheck was clean, and all 21 tests passed — while every single
 * /api/tasks request returned 500. A vitest test cannot catch this class of bug
 * by construction, because the runner is exactly what papers over it.
 *
 * The Postgres path is covered incidentally (the server boots it on every
 * `docker compose up`), but nothing boots the Mongo path unless you explicitly
 * run the overlay — hence the focus here.
 *
 * Add an entry whenever you add a module that no test imports and no default
 * boot path loads.
 */

const MODULES = ['../mongoose/models/Task.ts', '../mongoose/models/User.ts'];

let failed = 0;

for (const spec of MODULES) {
  try {
    await import(spec);
    console.log(`  ok    ${spec}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${spec}`);
    console.error(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} module(s) failed to load under the native ESM loader.`);
  console.error('If this mentions a missing named export from a CommonJS package');
  console.error('(mongoose, etc.), switch to a default import and destructure:\n');
  console.error("    import pkg from 'thepkg';");
  console.error('    const { a, b } = pkg;\n');
  process.exit(1);
}

console.log(`\nAll ${MODULES.length} modules load cleanly under the native ESM loader.`);
