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
