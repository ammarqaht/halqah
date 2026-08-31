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

## What exists today

| Route | Status | Spec ref |
|---|---|---|
| `/login` | **built** — two-column sign-in + opening animation | DESIGN.md §5 |
| `/admin` | **built** — overview: counters, distributions, halaqa progress, lists, shortcuts | SPEC.md §6.1 (إد-٢) |
| `/admin/students` | **built** — roster, halaqat in the panel, import preview and commit | SPEC.md §6.2–6.3 (إد-٣) |
| `/admin/points` | **built** — balances, grant to one/many/halaqa, ledger, honour roll | SPEC.md §6.4 (إد-٤-أ) |
| `/admin/points/codes` | **built** — issue a batch, track use, revoke | SPEC.md §6.5 (إد-٤-ب) |
| `/admin/store` | **built** — gifts, atomic purchase, orders, deliver and cancel | SPEC.md §6.6 (إد-٤-ج) |
| `/print/codes/[batchId]` · `/print/honour` · `/print/pick-list` | **built** — A4 card sheets with QR, the honour roll, and the delivery list | DESIGN.md §8 |
| `/admin/*` (plans · exams · follow-up) | placeholder screens, correct chrome and titles | BUILD_PLAN phases 4–5, 8 |
| `/student` | placeholder | BUILD_PLAN phase 7 |

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
