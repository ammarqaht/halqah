# حلقة — web

Next.js app for the Halqah system, built for **حلقات جامع محمد العبدالكريم — الدمام، حي أُحد**.

Specs live in [`docs/`](docs/):

| File | What it is |
|---|---|
| [`متطلبات-نظام-حلقة.pdf`](docs/متطلبات-نظام-حلقة.pdf) | The client-approved requirements, in Arabic. The source of truth for scope. |
| [`SPEC.md`](docs/SPEC.md) | Technical spec — data model, rules engine, import pipelines |
| [`DESIGN.md`](docs/DESIGN.md) | Design system, application shell, sign-in |
| [`BUILD_PLAN.md`](docs/BUILD_PLAN.md) | Phased build order |

> **No student data is in this repository, and none should ever be added.** The association's
> four workbooks carry students' names, national IDs and guardians' phone numbers; they stay
> out, and `.gitignore` excludes `*.xlsx` so they cannot slip in. Names and identifiers have
> been stripped from the documents above. The supervisor uploads his own file at runtime.

## Deploy

Built for [CranL](https://cranl.com) — a Dockerfile-based PaaS. The `Dockerfile` uses
Next.js standalone output and runs as a non-root user; point CranL at this repo, set the
port to `3000`, and choose the **MENA** region.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # rules engine — lib/points.ts against the approved figures
```

### The development database

Signing in needs a real row in `admin_users`, so development runs against a
Postgres of its own. It needs **nothing installed on the machine**: the binaries
come from `embedded-postgres`, and the cluster lives outside the repository —
under `%LOCALAPPDATA%\halqah-pg` on Windows, `~/.local/share/halqah-pg`
elsewhere — so deleting that folder deletes the database and touches no code.

It listens on **5433**, not 5432, so it can never be confused with a Postgres
already running on the machine. It holds the login account and the settings and
nothing else: every other screen still reads the browser store (see *Data*).

```bash
npm i --no-save embedded-postgres   # once, and after any npm install/ci
npm run db:dev                      # leave it running in its own window
npm run db:dev stop                 # from anywhere, when you need it down
```

`--no-save` is deliberate. Those are ~100 MB of Postgres binaries, and the
Dockerfile's `npm ci` installs devDependencies too, so listing it would pull a
Linux Postgres into every CranL build for nothing. It is a tool for one machine,
not a dependency of the project.

The cost is that `npm install` and `npm ci` both prune it, so that first line
comes back whenever you have run either — and it needs the cluster stopped
first, because Windows will not let npm replace a DLL that a running Postgres
holds open. That is what `stop` is for: Postgres runs detached, so closing the
window it was started in leaves it listening.

Anyone who already runs a Postgres of their own can skip all three lines and
point `DATABASE_URL` at it instead.

Then, in another window — and this is also how you rebuild from nothing, after
deleting the folder above:

```bash
npx prisma migrate deploy   # tables
npm run db:bootstrap        # the eight settings, and the admin / 12345 account
npm run dev
```

`DATABASE_URL` and `AUTH_SECRET` both live in `.env`, in one file because the
Prisma CLI reads only that one while Next reads both — the same secret in two
places only drifts apart. It is gitignored. **The development password is a
development password**: production credentials are set in CranL and never here,
and `ADMIN_PASSWORD` in the environment overrides the default without a code
change.

`GET /api/health` reports which link in the chain is broken — environment
variables present, database reachable, tables created. It reveals counts and
booleans only, so it is safe to call on the deployed site too.

## What exists today

| Route | Status | Spec ref |
|---|---|---|
| `/login` | **built** — two-column sign-in + opening animation | DESIGN.md §5 |
| `/admin` | **built** — overview: counters, distributions, halaqa progress, lists, shortcuts | SPEC.md §6.1 (إد-٢) |
| `/admin/students` | **built** — roster, halaqat in the panel, import preview and commit | SPEC.md §6.2–6.3 (إد-٣) |
| `/admin/points` | **built** — balances, grant to one/many/halaqa, ledger, honour roll | SPEC.md §6.4 (إد-٤-أ) |
| `/admin/points/codes` | **built** — issue a batch, track use, revoke | SPEC.md §6.5 (إد-٤-ب) |
| `/admin/store` | **built** — gifts, atomic purchase, orders, deliver and cancel | SPEC.md §6.6 (إد-٤-ج) |
| `/admin/exams` · `/admin/exams/new` | **built** — the exam log, and recording that feeds the points ledger | SPEC.md §6.8 (إد-٥-ب) |
| `/print/codes/[batchId]` · `/print/honour` · `/print/pick-list` | **built** — A4 card sheets with QR, the honour roll, and the delivery list | DESIGN.md §8 |
| `/admin/*` (plans · follow-up) | placeholder screens, correct chrome and titles | BUILD_PLAN phases 4, 8 |
| `/student` · `/student/login` · `/student/redeem` · `/student/store` · `/student/my-level` | **built** — PIN sign-in, and every figure from `/api/student/*` scoped by the cookie | BUILD_PLAN phase 7 |
| `/student/rank` | **built** — لوحة الشرف on the phone: podium, «أنت», server-windowed | DESIGN.md §6 |

The shell (rail + contextual panel + top bar) and the route veil are live on every
`/admin` route.

## Data

`lib/data.ts` is generated from the client's own workbooks — 102 students, 7 halaqat,
468 exam records, real track/stage/nationality splits. **No invented figures.**
BUILD_PLAN phase 1 replaces this module with Prisma queries; the component API does
not change when it does.

## Conventions that are not optional

- **RTL:** logical properties only (`ms-`/`me-`/`ps-`/`pe-`). A literal `left`/`right`
  is a bug except on the rail's physical edge indicator.
- **Every number** goes through `<Num>` — it bidi-isolates and tabular-aligns.
  Without it RTL reorders `4:45 – 6:15` into `6:15 – 4:45`.
- **Motion** animates `transform`/`opacity` only, and honours `prefers-reduced-motion`.
- **Four states per screen**: loading, empty, error+retry, content.
