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
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateTask, Task, TaskList, TaskStatus, UpdateTask } from '@shared/types';

import { api } from './client';
import type { ApiError } from './client';

/** Query-key factory. Every hook below and every invalidation reads from here. */
export const taskKeys = {
  all: ['tasks'] as const,
  list: (status?: TaskStatus) => ['tasks', 'list', status ?? 'all'] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
};

// --- transport ---------------------------------------------------------------

export async function fetchTasks(status?: TaskStatus): Promise<TaskList> {
  const res = await api.get<TaskList>('/tasks', { params: status ? { status } : undefined });
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

export function useTasks(status?: TaskStatus) {
  return useQuery<TaskList, ApiError>({
    queryKey: taskKeys.list(status),
    queryFn: () => fetchTasks(status),
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

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation<Task, ApiError, { id: string; patch: UpdateTask }>({
    mutationFn: ({ id, patch }) => updateTask(id, patch),
    onSuccess: (task) => {
      qc.setQueryData(taskKeys.detail(task.id), task);
      void qc.invalidateQueries({ queryKey: taskKeys.all });
      toast.success('Task updated');
    },
    onError: (err) => toast.error(err.message),
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
