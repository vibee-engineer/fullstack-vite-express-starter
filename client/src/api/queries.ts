import { useQuery } from '@tanstack/react-query';
import type { Health } from '@shared/types';

import { api } from './client';

/**
 * Example query — documents the pattern. One `useXQuery()` hook per read
 * endpoint, colocated by resource as the app grows (split into
 * `queries/user.ts`, `queries/post.ts`, ...).
 */
export function useHealthQuery() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<Health> => {
      const res = await api.get<Health>('/health');
      return res.data;
    },
  });
}
