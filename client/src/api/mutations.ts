import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateUser, User } from '@shared/types';

import { api } from './client';
import type { ApiError } from './client';

/**
 * Example mutation — documents the pattern: call the endpoint, invalidate
 * affected queries on success, surface `error.message` via toast on failure.
 * The agent copies this shape per resource.
 *
 * See `./tasks.ts` for the complete version: query-key factory, create /
 * update / delete, and invalidation that actually covers every affected key.
 */
export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation<User, ApiError, CreateUser>({
    mutationFn: async (payload) => {
      const res = await api.post<User>('/users', payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created');
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}
