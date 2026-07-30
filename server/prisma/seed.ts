/**
 * seed.ts — idempotent database seed. Runs via `npm run db:seed -w server`.
 * Every seed operation is an `upsert` so re-runs are safe.
 *
 * Tasks use a fixed `id` rather than a natural key because `Task` has no
 * unique business column — that's the pattern to copy when a resource has
 * nothing unique to key on.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TASKS = [
  {
    id: 'seed-task-1',
    title: 'Read the reference vertical',
    description:
      'Task is wired end to end: shared/src/schemas/task.ts → prisma + mongoose models → ' +
      'repositories/taskRepository.ts → routes/tasks.ts → client/src/api/tasks.ts → TasksPage.',
    status: 'done' as const,
  },
  {
    id: 'seed-task-2',
    title: 'Copy the shape for your first real resource',
    description: 'Schema first, then model + migration, then repository, then routes, then client.',
    status: 'in_progress' as const,
  },
  {
    id: 'seed-task-3',
    title: 'Delete the Task resource once you no longer need the example',
    description: 'It is a demo, not a dependency. Nothing else in the starter imports it.',
    status: 'todo' as const,
  },
];

async function main() {
  await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: { email: 'demo@example.com', name: 'Demo User' },
  });

  for (const task of TASKS) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: { title: task.title, description: task.description, status: task.status },
      create: task,
    });
  }

  console.log(`Seed complete: 1 user, ${TASKS.length} tasks.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
