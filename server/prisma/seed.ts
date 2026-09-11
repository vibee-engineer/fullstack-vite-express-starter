/**
 * seed.ts — idempotent demo-data seed. Runs via `npm run db:seed -w server`.
 *
 * THE PATTERN TO COPY: do NOT hand-type a handful of rows — that is the "toy
 * dashboard" tell ($854 MRR, 6 subscribers, flat charts). Generate realistic,
 * BACKDATED demo data with the seed engine (@/services/seed):
 *   - a deterministic seeded RNG → reproducible data, so re-seeding is safe;
 *   - a factory → hundreds of coherent rows in a few lines;
 *   - backdateSeries → `createdAt` spread across the last 12 months, so
 *     "activity over time" charts and period-over-period deltas are REAL.
 *
 * Idempotency: ids are derived from the deterministic RNG, so re-runs
 * `skipDuplicates` instead of piling up copies. Copy this shape for your real
 * resources; scale `count` to the domain (a SaaS seeds hundreds of signups; a
 * solo plumber seeds dozens of jobs — realistic FOR THE BUSINESS).
 */
import { PrismaClient } from '@prisma/client';

import { SeededRandom, defineFactory } from '../src/services/seed';

const prisma = new PrismaClient();

// One RNG seeded by a stable string → the whole seed is reproducible.
const rng = new SeededRandom('fullstack-starter-demo');

const STATUS = [['done', 6] as const, ['in_progress', 3] as const, ['todo', 4] as const];

// Factory: each task gets a deterministic id, a human-shaped title, a weighted
// status, and (below) a backdated createdAt so the list has real history.
const taskFactory = defineFactory((r) => ({
  id: r.id('task'),
  title: `${r.phrase(2)} — ${r.company()}`.replace(/\b\w/g, (c) => c.toUpperCase()),
  description: r.bool(0.6) ? `${r.phrase(3)} for ${r.fullName()} (${r.city()})` : null,
  status: r.weighted(STATUS),
}));

async function main() {
  await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: { email: 'demo@example.com', name: 'Demo User' },
  });

  // 48 backdated tasks across the last 12 months, trending up. `createdAt` is
  // set explicitly to override the model's @default(now()); `updatedAt` is
  // managed by Prisma (@updatedAt).
  const tasks = taskFactory.buildMany(rng, 48, {
    backdate: { monthsBack: 12, trend: 'growth' },
  });

  const result = await prisma.task.createMany({
    data: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      createdAt: t.createdAt,
    })),
    skipDuplicates: true,
  });

  console.log(`Seed complete: 1 user, ${result.count} tasks (backdated across 12 months).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
