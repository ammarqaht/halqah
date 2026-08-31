#!/bin/sh
set -e
echo "[start] applying migrations…"
node node_modules/prisma/build/index.js migrate deploy
echo "[start] bootstrap…"
node scripts/bootstrap.mjs
echo "[start] serving on :${PORT:-3000}"
exec node server.js
