# syntax=docker/dockerfile:1
# Halqah — CranL builds from this file. Next.js `output: 'standalone'` keeps the
# runtime image small, which is what makes cold starts short on a container PaaS.

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# the schema must be present before `npm ci`: postinstall runs `prisma generate`,
# which reads it. Copying only the manifests here is what broke the first build.
COPY prisma ./prisma
RUN npm ci

# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# never run the app as root
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# migrations run at boot: the database host is internal to the platform and
# unreachable from a developer machine, so this is where schema changes land.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
# prisma migrate deploy pulls a deep transitive tree (@prisma/config → effect,
# c12, fast-check, …). Copy every non-scoped runtime dep in one layer instead
# of chasing each module individually.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/effect ./node_modules/effect
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pure-rand ./node_modules/pure-rand
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/c12 ./node_modules/c12
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/chokidar ./node_modules/chokidar
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/confbox ./node_modules/confbox
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/defu ./node_modules/defu
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/giget ./node_modules/giget
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/jiti ./node_modules/jiti
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ohash ./node_modules/ohash
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pathe ./node_modules/pathe
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/perfect-debounce ./node_modules/perfect-debounce
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pkg-types ./node_modules/pkg-types
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/rc9 ./node_modules/rc9
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/deepmerge-ts ./node_modules/deepmerge-ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/empathic ./node_modules/empathic
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/citty ./node_modules/citty
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/consola ./node_modules/consola
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/destr ./node_modules/destr
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/exsolve ./node_modules/exsolve
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/node-fetch-native ./node_modules/node-fetch-native
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/nypm ./node_modules/nypm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tinyexec ./node_modules/tinyexec
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/anymatch ./node_modules/anymatch
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/binary-extensions ./node_modules/binary-extensions
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/braces ./node_modules/braces
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/fill-range ./node_modules/fill-range
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/glob-parent ./node_modules/glob-parent
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/is-binary-path ./node_modules/is-binary-path
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/is-extglob ./node_modules/is-extglob
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/is-glob ./node_modules/is-glob
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/is-number ./node_modules/is-number
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/normalize-path ./node_modules/normalize-path
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/picomatch ./node_modules/picomatch
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/readdirp ./node_modules/readdirp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/to-regex-range ./node_modules/to-regex-range
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@standard-schema ./node_modules/@standard-schema

USER nextjs
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
