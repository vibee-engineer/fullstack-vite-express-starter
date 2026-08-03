import axios, { AxiosError } from 'axios';

/**
 * Axios instance for all `/api/*` calls. `withCredentials` is on so cookie-
 * based sessions work when the agent wires auth. The response interceptor
 * normalizes errors to `{ message, code, details? }` matching the server's
 * error middleware shape.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 15_000,
});

/**
 * `apiClient` is the same instance under the name agents reach for.
 *
 * This is not decoration. Two independent ATS builds (2026-08-03, tasks
 * 6a7088f0c3deea3fdf49302f and 6a708f0076838d3b407b4ad9) each wrote
 * `import { apiClient } from '@/api/client'`, and because only `api` was
 * exported, Vite threw
 *
 *   "The requested module '/src/api/client.ts' does not provide an export
 *    named 'apiClient'"
 *
 * at module-evaluation time. That is fatal in a way a normal bug is not: the
 * entry module never evaluates, React never mounts, and the whole app is a
 * white screen — with a fully working backend behind it. Both builds otherwise
 * passed every gate and were recorded as completed.
 *
 * `apiClient` is the more guessable name (it says what it is), so exporting it
 * as well removes an entire class of total-failure by making the guess right.
 * Both names are the identical axios instance; use whichever reads better.
 */
export const apiClient = api;

export type ApiError = {
  message: string;
  code?: string;
  status: number;
  details?: unknown;
};

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error?: { message?: string; code?: string; details?: unknown } }>) => {
    const status = err.response?.status ?? 0;
    const body = err.response?.data?.error;
    const normalized: ApiError = {
      status,
      message: body?.message ?? err.message ?? 'Request failed',
      code: body?.code,
      details: body?.details,
    };

    // On 401 in a protected context, punt to /login. The agent wires the
    // real login page — leaving this here so the pattern is obvious.
    if (status === 401 && typeof window !== 'undefined') {
      // Uncomment when auth is wired:
      // window.location.assign('/login');
    }

    return Promise.reject(normalized);
  },
);
