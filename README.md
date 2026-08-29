# حلقة — web

Next.js app for the Halqah system. Built against the three specs one directory up:
`SPEC.md` (what) · `DESIGN.md` (how it looks) · `BUILD_PLAN.md` (in what order).

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

## What exists today

| Route | Status | Spec ref |
|---|---|---|
| `/login` | **built** — two-column sign-in + opening animation | DESIGN.md §5 |
| `/admin` | **built** — overview: counters, distributions, halaqa progress, lists, shortcuts | SPEC.md §6.1 (إد-٢) |
| `/admin/*` | placeholder screens, correct chrome and titles | BUILD_PLAN phases 3–8 |
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
