import { QueryClient } from '@tanstack/react-query';

import type { ApiError } from '@/api/client';

/** Retry once on network/5xx; never on a 4xx (except 408/429) — it cannot change. */
function retryOnce(failureCount: number, error: unknown): boolean {
  const status = (error as Partial<ApiError> | null)?.status ?? 0;
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  return failureCount < 1;
}

/** Shared singleton — every mutation invalidates against this instance. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: retryOnce,
    },
    mutations: {
      retry: 0,
    },
  },
});
