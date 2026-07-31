import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // REQUIRED for the hosted preview to render at all.
    //
    // Vite 5.4.12+ / 6 check the Host header against `server.allowedHosts` as a
    // DNS-rebinding mitigation (CVE-2025-31125) and reject anything unlisted
    // with a 403 text page:
    //
    //   Blocked request. This host ("fdev-xxxx.fly.dev") is not allowed.
    //
    // The preview is served from a per-project Fly hostname, so without this
    // every fullstack app showed that 403 instead of the UI. It is easy to
    // misread as a CORS problem; it is not. CORS never applies here — the
    // client calls `/api` same-origin through nginx, and indeed `/api/*`
    // returned 200 with real JSON while `/` was 403. Only the Vite dev server
    // was refusing, purely on the Host header.
    //
    // A leading dot matches subdomains, so this allows any *.fly.dev preview
    // host without resorting to `allowedHosts: true` (which would disable the
    // check entirely). localhost/127.0.0.1 stay permitted by Vite regardless,
    // which keeps `npm run dev` and the docker-compose flow working.
    allowedHosts: ['.fly.dev'],
    // HMR through the nginx terminator. The browser-visible port differs by
    // environment, which is why this is an env var rather than a constant:
    //
    //   local docker compose -> you browse http://localhost:8888  -> 8888
    //   hosted Fly preview   -> you browse https://<app>.fly.dev  -> 443
    //
    // Vite bakes `clientPort` into the HMR client at serve time, so a hardcoded
    // 8888 made the hosted preview open `wss://<app>.fly.dev:8888`, which Fly
    // does not expose. The socket failed with ERR_CONNECTION_CLOSED and the
    // preview silently stopped live-updating — edits only appeared on a manual
    // refresh. Vite's own default is worse here (it would use 5173, which nginx
    // does not expose either), so it does need to be set explicitly.
    //
    // 8888 is the default so `npm run dev` and plain `docker compose up` work
    // untouched; the hosted compose sets VITE_HMR_CLIENT_PORT=443.
    hmr: {
      clientPort: Number(process.env.VITE_HMR_CLIENT_PORT ?? 8888),
    },
  },
  optimizeDeps: {
    // Pre-bundle the shadcn/Radix primitives so the first navigation doesn't
    // pay a cold-boot recompile cost.
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'axios',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'sonner',
    ],
  },
});
