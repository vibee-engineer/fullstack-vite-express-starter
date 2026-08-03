/**
 * TasksPage.tsx — THE REFERENCE PAGE. Copy this file's structure per resource.
 *
 * Non-negotiable: a list view renders FOUR states, not one.
 *   1. loading  → `<Skeleton />` rows shaped like the real content
 *   2. error    → `<Alert variant="destructive">` with a retry affordance
 *   3. empty    → `<EmptyState />`, never a blank div
 *   4. loaded   → the list
 *
 * Skipping any of them is the single most common defect in generated UIs, so
 * all four are wired here explicitly and asserted in
 * `__tests__/TasksPage.test.tsx`.
 *
 * Forms use react-hook-form + `zodResolver` against the SHARED schema, so
 * client-side validation and server-side validation can never disagree.
 */

import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ListChecks, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { CreateTaskSchema } from '@shared/schemas/task';
import type { CreateTask, Task, TaskStatus } from '@shared/types';

import { SITE } from '@/config/site';
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '@/api/tasks';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

/** Presentation metadata per status. Keep in sync with `TASK_STATUSES`. */
const STATUS_META: Record<
  TaskStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  todo: { label: 'To do', variant: 'outline' },
  in_progress: { label: 'In progress', variant: 'secondary' },
  done: { label: 'Done', variant: 'default' },
};

/** Click the badge to advance the lifecycle — todo → in progress → done → todo. */
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

export function TasksPage() {
  const tasks = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const form = useForm<CreateTask>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: { title: '', description: '' },
  });

  // `mutateAsync` rejects on failure; the hook's `onError` already toasts, so
  // swallow here rather than letting it escape as an unhandled rejection.
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createTask.mutateAsync({
        title: values.title,
        description: values.description?.trim() ? values.description : null,
      });
      form.reset({ title: '', description: '' });
    } catch {
      /* surfaced by useCreateTask's onError toast */
    }
  });

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setDraftTitle(task.title);
  };

  const commitEdit = async (task: Task) => {
    const title = draftTitle.trim();
    if (!title || title === task.title) {
      setEditingId(null);
      return;
    }
    try {
      await updateTask.mutateAsync({ id: task.id, patch: { title } });
    } catch {
      /* surfaced by useUpdateTask's onError toast */
    }
    setEditingId(null);
  };

  return (
    <>
      <Helmet>
        <title>Tasks — {SITE.name}</title>
        <meta name="description" content="The starter's reference CRUD vertical." />
      </Helmet>

      {/* App rhythm, not marketing rhythm: AppShell already supplies the page
          gutters (px-4 / lg:px-6, py-6) and the scroll container, so a page adds
          only its own vertical spacing. Do NOT wrap an app page in
          `container max-w-3xl py-12` — that is a marketing measure and it makes
          a dashboard read as a narrow column of cards in a sea of whitespace. */}
      <div className="space-y-6">
        <PageHeader
          title="Tasks"
          description="The reference CRUD vertical — shared zod schema, Express router, repository, typed client hooks, and the four list states. Copy this shape for your own resources."
          action={
            <Button size="sm" onClick={() => document.getElementById('title')?.focus()}>
              <Plus aria-hidden className="size-4" />
              New task
            </Button>
          }
        />

        {/* KPI row. A dashboard opens with the two-to-four numbers that answer
            "how am I doing", then goes into detail — not straight into a chart.
            Values use tabular-nums via StatCard so they do not jitter when they
            change. */}
        {tasks.isSuccess ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total" value={tasks.data.items.length} icon={ListChecks} hint="all tasks" />
            <StatCard
              label="Done"
              value={tasks.data.items.filter((t) => t.status === 'done').length}
              icon={Check}
              hint="completed"
            />
            <StatCard
              label="Open"
              value={tasks.data.items.filter((t) => t.status !== 'done').length}
              icon={Pencil}
              hint="still to do"
            />
          </div>
        ) : null}

        {/* --- create ------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New task</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Ship the thing"
                  aria-invalid={Boolean(form.formState.errors.title)}
                  {...form.register('title')}
                />
                {form.formState.errors.title ? (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={2}
                  placeholder="Optional detail"
                  {...form.register('description')}
                />
                {form.formState.errors.description ? (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.description.message}
                  </p>
                ) : null}
              </div>

              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add task
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* --- 1. loading --------------------------------------------------- */}
        {tasks.isPending ? (
          <div className="space-y-3" data-testid="tasks-loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-border p-4">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : null}

        {/* --- 2. error ----------------------------------------------------- */}
        {tasks.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t load tasks</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{tasks.error.message}</p>
              <Button variant="outline" size="sm" onClick={() => void tasks.refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* --- 3. empty ----------------------------------------------------- */}
        {tasks.isSuccess && tasks.data.items.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Add your first task to see it here."
            // The action is the point of an empty state: never leave the user
            // with copy telling them to act and nothing to click. Focusing the
            // existing form is a legitimate action when the form is on-page;
            // when it is not, link or open the create surface.
            action={
              <Button
                size="sm"
                onClick={() => document.getElementById('title')?.focus()}
              >
                Add a task
              </Button>
            }
          />
        ) : null}

        {/* --- 4. loaded ---------------------------------------------------- */}
        {tasks.isSuccess && tasks.data.items.length > 0 ? (
          <ul className="space-y-3" aria-label="Tasks">
            {tasks.data.items.map((task) => {
              const meta = STATUS_META[task.status];
              const isEditing = editingId === task.id;

              return (
                <li
                  key={task.id}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <button
                    type="button"
                    onClick={() =>
                      updateTask.mutate({
                        id: task.id,
                        patch: { status: NEXT_STATUS[task.status] },
                      })
                    }
                    aria-label={`Advance status of ${task.title}`}
                    className="mt-0.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    {isEditing ? (
                      <Input
                        autoFocus
                        aria-label={`Edit title of ${task.title}`}
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitEdit(task);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <p
                        className={
                          task.status === 'done'
                            ? 'truncate text-sm font-medium text-muted-foreground line-through'
                            : 'truncate text-sm font-medium'
                        }
                      >
                        {task.title}
                      </p>
                    )}
                    {task.description ? (
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Save ${task.title}`}
                          onClick={() => void commitEdit(task)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Cancel editing ${task.title}`}
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${task.title}`}
                        onClick={() => startEdit(task)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${task.title}`}
                      disabled={deleteTask.isPending}
                      onClick={() => deleteTask.mutate(task.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </>
  );
}
