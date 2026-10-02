/**
 * tasks.ts — THE REFERENCE CLIENT MODULE. Copy this file per resource.
 *
 * Shape: a `taskKeys` factory, thin typed transport functions, then one
 * TanStack Query hook per operation.
 *
 * Two rules that keep generated UIs correct:
 *   1. Query keys come from a `<resource>Keys` factory, never inline literals.
 *      Inline keys drift (`['tasks']` vs `['task']`) and invalidation silently
 *      stops working.
 *   2. Every mutation invalidates the list key on success and surfaces
 *      `err.message` on failure. The axios interceptor in `./client.ts` has
 *      already normalized the server's `{ error: { message, code } }` envelope,
 *      so `err.message` is always human-readable.
 *
 * `useUpdateTask` is the OPTIMISTIC template (TanStack Query "Optimistic
 * Updates" guide): patch every cached list in onMutate, roll back in onError,
 * re-sync in onSettled. Use it for toggles and inline edits the user expects
 * to feel instant; plain invalidate-on-success is fine for create/delete.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateTask, Task, TaskList, TaskListQuery, UpdateTask } from '@shared/types';

import { api } from './client';
import type { ApiError } from './client';

/** What a list view can ask the server for. Mirrors `TaskListQuerySchema`. */
export type TaskListParams = Partial<Pick<TaskListQuery, 'status' | 'q' | 'sort' | 'dir'>>;

/** Query-key factory. Every hook below and every invalidation reads from here. */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => ['tasks', 'list'] as const,
  // The params object IS part of the key: a new search or sort is a new cache entry.
  list: (params: TaskListParams = {}) => ['tasks', 'list', params] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
};

// --- transport ---------------------------------------------------------------

export async function fetchTasks(params: TaskListParams = {}): Promise<TaskList> {
  // Drop empty values so `?q=` never reaches the server.
  const query = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  );
  const res = await api.get<TaskList>('/tasks', {
    params: Object.keys(query).length ? query : undefined,
  });
  return res.data;
}

export async function fetchTask(id: string): Promise<Task> {
  const res = await api.get<Task>(`/tasks/${id}`);
  return res.data;
}

export async function createTask(payload: CreateTask): Promise<Task> {
  const res = await api.post<Task>('/tasks', payload);
  return res.data;
}

export async function updateTask(id: string, patch: UpdateTask): Promise<Task> {
  const res = await api.patch<Task>(`/tasks/${id}`, patch);
  return res.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

// --- hooks -------------------------------------------------------------------

export function useTasks(params: TaskListParams = {}) {
  return useQuery<TaskList, ApiError>({
    queryKey: taskKeys.list(params),
    queryFn: () => fetchTasks(params),
    // Keep showing the previous results while a new search/sort loads, instead
    // of flashing the skeleton on every keystroke. `isPlaceholderData` is true
    // meanwhile; dim the list with it.
    placeholderData: keepPreviousData,
  });
}

export function useTask(id: string) {
  return useQuery<Task, ApiError>({
    queryKey: taskKeys.detail(id),
    queryFn: () => fetchTask(id),
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation<Task, ApiError, CreateTask>({
    mutationFn: createTask,
    onSuccess: () => {
      // `taskKeys.all` is a prefix of every list + detail key, so one
      // invalidation covers all of them.
      void qc.invalidateQueries({ queryKey: taskKeys.all });
      toast.success('Task created');
    },
    onError: (err) => toast.error(err.message),
  });
}

type UpdateVars = { id: string; patch: UpdateTask };
type Snapshot = { lists: [readonly unknown[], TaskList | undefined][]; detail: Task | undefined };

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation<Task, ApiError, UpdateVars, Snapshot>({
    mutationFn: ({ id, patch }) => updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      // Stop in-flight refetches from overwriting the optimistic value.
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const snapshot: Snapshot = {
        lists: qc.getQueriesData<TaskList>({ queryKey: taskKeys.lists() }),
        detail: qc.getQueryData<Task>(taskKeys.detail(id)),
      };
      const apply = (t: Task): Task => (t.id === id ? { ...t, ...patch } : t);
      qc.setQueriesData<TaskList>({ queryKey: taskKeys.lists() }, (old) =>
        old ? { ...old, items: old.items.map(apply) } : old,
      );
      if (snapshot.detail) qc.setQueryData(taskKeys.detail(id), apply(snapshot.detail));
      return snapshot;
    },
    onError: (err, { id }, snapshot) => {
      // Roll back to exactly what was on screen before the click.
      snapshot?.lists.forEach(([key, data]) => qc.setQueryData(key, data));
      if (snapshot?.detail) qc.setQueryData(taskKeys.detail(id), snapshot.detail);
      toast.error(err.message);
    },
    onSuccess: (task) => {
      qc.setQueryData(taskKeys.detail(task.id), task);
      toast.success('Task updated');
    },
    // Success or failure, re-sync with the server (filters/sort may have changed membership).
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: deleteTask,
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: taskKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: taskKeys.all });
      toast.success('Task deleted');
    },
    onError: (err) => toast.error(err.message),
  });
}
