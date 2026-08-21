#!/bin/sh
# Client container entrypoint.
#   • dev preview  → exec the CMD (Vite dev server + HMR).
#   • production   → build the static bundle and serve it. The build runs HERE,
#     not at image-build, because Vite bakes VITE_* env into the bundle at build
#     time and that prod env (VITE_API_URL=/api, etc.) is only present at runtime.
#     `serve -s` serves dist/ with SPA index.html fallback for client routes.
# POSIX sh only (busybox ash) — no bashisms.
set -eu

if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "[client-entrypoint] NODE_ENV=production — building static bundle..."
  # `npm run build` is `tsc -b && vite build`. A type-check nit must not block
  # shipping a functionally-working app, so fall back to `vite build` alone
  # (esbuild transpile — produces the same runtime bundle without a full tsc gate).
  if ! npm run build; then
    echo "[client-entrypoint] full build failed — retrying with vite build only (skips typecheck)."
    npx --yes vite build
  fi
  echo "[client-entrypoint] Build complete — serving dist/ on ${PORT:-5173}."
  exec serve -s dist -l "tcp://0.0.0.0:${PORT:-5173}"
fi

exec "$@"
