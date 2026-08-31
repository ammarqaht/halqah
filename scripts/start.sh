#!/bin/sh
# The server must come up even when the database will not. A container that
# exits on a database hiccup takes the whole site down and returns Bad Gateway;
# a container that starts and reports the problem is diagnosable from the UI.
# So: no `set -e` around the database steps.

echo "[start] applying migrations…"
if node node_modules/prisma/build/index.js migrate deploy; then
  echo "[start] migrations ok"
  echo "[start] bootstrap…"
  node scripts/bootstrap.mjs || echo "[start] ⚠ bootstrap failed — the app will still serve"
else
  echo "[start] ⚠ migrations failed — the app will still serve, but the database is not ready"
fi

echo "[start] serving on :${PORT:-3000}"
exec node server.js
