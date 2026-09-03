# Halqah — Build Plan

Companion to **`SPEC.md`** (the *what*) and **`DESIGN.md`** (the *how it looks*). This file is the *when* and *in what order*.

**Target:** first working version (MVP) — the client expects it around **6 Sep 2026**.
**Method:** thin vertical slices. Every phase ends with something the supervisor can actually open and use. No phase leaves a half-wired screen behind.

**Rule for each phase:** schema → rules + tests → API → screen → seed/verify with real data. Never build all the schema first.

---

## Phase 0 — Foundation (½ day)

- [ ] `create-next-app` (TypeScript, App Router, Tailwind), `dir="rtl"` + `lang="ar"` on `<html>`
- [ ] `Dockerfile` with `output: 'standalone'`; verify a local `docker build && docker run` before touching CranL
- [ ] CranL: project, app from GitHub, **PostgreSQL in MENA**, S3 bucket, env vars
- [ ] Prisma + `lib/db.ts` singleton (connection limit set in the URL — containers, not serverless)
- [ ] Design tokens into `tailwind.config.js` verbatim from `DESIGN.md` §1–§3 (palette, both type scales, spacing)
- [ ] Self-host `BrandArabic` (Thmanyah Sans) + `BrandDisplay` (Thmanyah Serif Display) as subsetted woff2
- [ ] `<Num>` bidi-isolation component + Arabic number-agreement helper (`DESIGN.md` §2.2) — needed before any screen
- [ ] Print stylesheet skeleton (`DESIGN.md` §8)
- [ ] Deploy a hello-world to the CranL domain

**Done when:** an empty Arabic RTL page is live on HTTPS with the brand fonts, and `prisma migrate` runs against the managed DB.

---

## Phase 1 — Reference data & roster (1 day)

This is the load-bearing phase. Everything later reads from it.

- [ ] Schema: `teachers`, `halaqat`, `students`, `curriculum_levels`, `curriculum_days`, `settings`
- [ ] `lib/rules.ts`: `nextLevel`, `ajzaForLevel` + **unit tests** (§4.1–4.2)
- [ ] `scripts/seed/curriculum.ts` — parse `منهج الحفظ.xlsx` sheets `فضي` + `ذهبي`
      - normalise `ﷴ` → `محمد`, `أخ/اخ/آخ` → `آخر`
      - mark day 12 / day 24 as exam days
      - **assert 24 days × 3 kinds for every level, or fail loudly**
- [ ] `scripts/seed/levels.ts` — level→ajza table from `قائمة المستويات`
- [ ] `scripts/seed/roster.ts` — 103 students + 7 halaqat + 7 teachers from `قاعدة بيانات الحلقات.xlsx`
      - `national_id = abs(value)` stored as text **exactly as found** — no length validation (client: «دخلها زي ما هي عليه»)
      - flag short/long/duplicate for information only; skip the `المجموع` row
- [ ] `scripts/seed/settings.ts` — the JSON block in SPEC §3.8

**Verify:** Silver = 21 levels (60→40), Golden = 30 levels (30→1), 5902 curriculum rows total, **102 students** (103 name rows − the `المجموع` row) with **101 distinct IDs**, tracks split 61/30/11 (SILVER/TALQEEN/GOLDEN), nationality 48/55.

**Done when:** the numbers above come back from SQL, not from a spreadsheet.

---

## Phase 2 — Auth & shell (½ day)

- [ ] `admin_users`, `student_credentials`; `lib/auth.ts` (bcrypt + jose, split `aud`)
- [ ] `/login`, session cookie, middleware guards for `/admin/*` and `/student/*`
- [ ] Admin shell per `DESIGN.md` §4: 72px icon rail (`brand-900`) + 240px contextual panel + TopBar, with the corrected nav map from §6
- [ ] Sign-in screen + opening animation (`DESIGN.md` §5), session-gated, `prefers-reduced-motion` honoured
- [ ] Seed one supervisor account

**Done when:** the supervisor logs in and lands on an empty overview; direct URL access to `/admin/*` while logged out redirects.

---

## Phase 3 — Students & halaqat (1 day)  → *first screen the client can react to*

- [ ] `/admin/students` list: search, filters, one indexed query, Excel export
- [ ] `/admin/students/[id]` profile (level timeline and exams stay empty for now)
- [ ] `/admin/halaqat`: CRUD, two-list assignment, transfer + `halaqa_transfers`
- [ ] "No halaqa" alert surfaces on the (still bare) overview
- [ ] `audit_log` written on every edit from here onward

**Checkpoint:** show the client. Roster + circles are the part they can judge instantly.

---

## Phase 4 — Plans & printing (1½ days)  → *replaces the daily Excel ritual*

- [ ] `student_plans`, `student_plan_days`
- [ ] Plan resolution: `curriculum_days` LEFT JOIN overrides
- [ ] `/admin/plans`: student search → auto track/halaqa/**next level** → preview
- [ ] Plan editor: edit a day, add surahs, add/remove days, move exam days, per-day note, "restore original", save-for-student vs save-for-level (double confirm + audit)
- [ ] `/print/plan/[planId]` — header, 24-day table, exam days 12/24, tajweed footer
- [ ] **Print action saves `issued_at` in the same request** — no separate save button
- [ ] Seed `student_plans` history from `قاعدة بيانات متابعة خطة الحفظ` (984 rows)
- [x] `isLate` rule + test; "late on level" alert live
- [ ] Bulk print

**Checkpoint:** the supervisor prints a real plan for a real student and compares it against his Excel printout side by side.

---

## Phase 5 — Exams (1½ days)

- [x] `exams` + `tajweed_topics` (`exam_questions` belongs to إد-٥-ج, below)
- [x] Rules §4.1 §4.2 §4.4 §4.5 §4.8 + tests — `lib/exams.ts`, 32 assertions quoting the PDF
- [x] `/admin/exams/new` — full form, auto-fill, suggested ajza/pass/points; and `/admin/exams`, the log that replaces «ملف الاختبارات»
- [ ] Seed 468 exam records + 47 tajweed records from `الاختبارات.xlsx` — needs the client workbook, which stays outside the repo
- [ ] `/admin/exams/import` — Qiyas importer. Buildable from §5.2 but **unverifiable without a sample export**; ask for one first
- [~] Post-save automations: **next-level suggestion built**; the student page and the teacher report do not exist yet, so their halves wait on §6.2 and §6.11
- [x] `/admin/exams/onsite` — bookings + exam screen with **variable question count** and **per-question surah field**, live score, one-tap approve. Surah suggestions come from the uploaded curriculum for the student's own level; the day's list prints at `/print/bookings`

**Checkpoint:** history is in, and the supervisor records one live exam end to end.

---

## Phase 6 — Points, codes, store (2 days)  → *the client's #1 reason for the project*

- [x] `point_transactions` ledger + balance aggregate — `lib/points.ts`, append-only, corrections as opposite rows
- [x] `/admin/points`: balances, add to one/many/halaqa, required reason, ledger. **Talqeen blocked at the mutation layer** (`store.grantPoints`, which reports who it skipped)
- [x] `point_code_batches`, `point_codes`; generator (Crockford base32 minus `I O U 1 0`, rejection-sampled, uniqueness checked against every existing code)
- [x] `/print/codes/[batchId]` — QR cards, colour by value, spent cards omitted
- [x] Batch tracking + revoke
- [x] لوحة الشرف at `/print/honour` — top ten, greyscale-safe
- [x] Unit tests for `lib/points.ts` — `npm test` (vitest). 43 assertions, each quoting a figure from the approved PDF rather than from the implementation, so the suite fails if the code drifts from what the client agreed to
- [ ] Atomic redemption (SPEC §3.5) + **a concurrency test that fires the same code twice** — `store.redeemCode` has the right *shape* and single-commit semantics, but the real guarantee is the conditional `UPDATE`, and that arrives with Prisma in phase 1
- [x] `gifts` + image upload; `/admin/store` — S3 deferred with the rest of the infrastructure, so images are downscaled to 512px JPEG data URLs and the quota failure is surfaced instead of swallowed (`lib/image.ts`)
- [x] `orders`: atomic purchase, deliver, cancel-with-refund, printable pick-list at `/print/pick-list`
- [x] Overview alerts «هدية قاربت على النفاد» and «طلبات بانتظار التسليم», which SPEC §6.1 held for this phase, plus the rail badge — all read from the orders themselves

**Checkpoint:** print a sheet of cards, scan one on a phone, watch the balance move.
*Half-met: cards print and balances move. Scanning waits on the student portal
(phase 7), which is where the camera lives.*

---

## Phase 7 — Student portal (1 day)

- [ ] `/student` home, `/student/redeem` (camera scan), `/student/store` + `/student/orders`, `/student/my-level`
- [ ] Bulk-create student credentials + printable credential sheets per halaqa
- [ ] Ownership assertions on every student route
- [ ] Performance pass: < 100 KB JS on first load

**Checkpoint:** pilot with one halaqa before switching everyone on.

---

## Phase 8 — Ratel import, follow-up, overview, reports (1½ days)

- [ ] `ratel_imports` / `ratel_rows`; header-detection parser + normalisation (SPEC §5.1)
- [ ] Preview → matched / new / needs-review; commit; never delete
- [x] `/admin/follow-up` by halaqa and by student
- [x] Ready lists: association-ready, late, not-examined, top performers
- [ ] `/admin` overview: counters, all 8 alerts in one CTE query, halaqa progress
- [x] Remaining phase-1 reports (SPEC §6.11)
- [ ] CranL cron: nightly alert recompute + `pg_dump` to S3

**Done when:** the client can answer "how is my circle doing?" without opening a spreadsheet.

---

## Phase 9 — Hardening & handover (1 day)

- [ ] Rate limiting, login throttling, upload validation
- [ ] Error boundaries and empty states in Arabic — no raw stack traces, no English fallbacks
- [ ] Reconcile every seeded table against the original workbooks
- [ ] Restore a backup into a scratch DB and verify
- [ ] Custom domain + SSL
- [ ] One-page Arabic operator guide + a walkthrough session with the supervisor

---

## Cross-cutting, from day one

- **RTL:** logical CSS properties only. Test every screen at 375 px. (`DESIGN.md` §9)
- **Four states per screen:** loading skeleton, empty, error+retry, and content. A screen without all four is not done.
- **Arabic numerals:** Arabic-Indic (٠١٢٣) in printed output, Latin in inputs. Pick one and be consistent per surface.
- **Dates:** store `timestamptz`, display Gregorian; add Hijri only if asked.
- **Transactions:** any mutation touching more than one table is one DB transaction.
- **No silent failure:** an import that cannot match a row *shows* it. A missing curriculum level *errors*. Never render a blank cell where data was expected.
- **Audit everything** the supervisor edits.
- **Tests:** `lib/rules.ts` is fully covered. Add a concurrency test for code redemption and for purchase.

---

## Ordering rationale

Plans (phase 4) come before points (phase 6) even though points are the client's stated #1 need, because plan printing is his **daily** friction and it exercises the curriculum seed — the riskiest data in the project. If the curriculum is wrong, everything downstream is wrong, and it is better to find that out on day 3 than on day 10.

Ratel import (phase 8) comes last among the data paths because nothing else depends on it: it enriches the follow-up screens but blocks no workflow. If time runs short, phase 8 is the one to trim for the first delivery — the supervisor keeps pulling his Ratel sheet for another week.
