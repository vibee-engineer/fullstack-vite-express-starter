import helmet from 'helmet';

/**
 * helmetMiddleware — default helmet with CSP disabled (Vite's HMR client
 * uses eval + inline scripts in dev; production overlay can lock this
 * down). Import from here if you need to override a directive per-route.
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});
