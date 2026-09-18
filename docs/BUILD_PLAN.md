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

## Phase 10 — بوابة المعلم (5 days foundation + 9 screens)

From «متطلبات بوابة المعلم — النسخة الثالثة» (15 Sep 2026). The document was held against this
codebase before a line was written, and **five of the portal's pillars had no table under them** —
which is why this phase is foundation-then-screens and not screens.

### 10.0 The foundation that did not exist  ✅
- [x] `teachers` — a teacher was a NAME in `halaqat.teacher`. Accounts are derived from those names,
      never typed again; `halaqat.teacher_id` is `@unique`, so «لكل معلم حلقة واحدة» is a constraint
      and not a comment
- [x] `day_entries` + `recitation_lines` + `day_entry_revisions` — a dated attendance and recitation
      record. `students.attended_days` was a 0–7 count from رتل with no dates behind it, so no
      absence list and no repeat-absence rule could exist
- [x] `student_progress` — **the مقرّر pointer**, «أخطر النواقص». The system recorded that a plan was
      ISSUED, never how far into it a student got. Its own table, NOT a column on `student_plans`:
      that table is deleted and rewritten by every supervisor save
- [x] `admin_messages` + reads — «رسائل الإدارة» on the teacher's home screen
- [x] `settings.daily_points` + `settings.halaqa_weekdays`
- [x] `point_txns.effective_on` — «تُسجَّل بتاريخ يومها لا بتاريخ إدخالها»
- [x] **`PUT /api/state` no longer deletes the teacher's ledger rows.** The one table both portals
      write into; without this, a save from the supervisor's laptop erased an afternoon of التحضير
      silently, every time

### 10.1 Rules and tests  ✅
- [x] `lib/teacher.ts` — calendar, pointer, daily points, absence, Umm al-Qura dates
- [x] `lib/teacher.test.ts` — **45 assertions**, each quoting the sentence it came from rather than
      the implementation, so the suite fails if the code drifts from what was agreed

### 10.2 Screens  ✅
- [x] `/teacher/login` · `/teacher/password` — four digits from 2001, and a real password
- [x] `/teacher` — بطاقة اليوم, four figures, تنبيهات حلقتي
- [x] `/teacher/register` — **the heart**: the three modes, 25 cards on one page, save per card,
      and an offline outbox designed in from the first line rather than retrofitted
- [x] `/teacher/students` + `/teacher/students/[id]`
- [x] `/teacher/points` — balances, ledger by source, honour board, orders (read-only)
- [x] `/teacher/reports` + seven printed sheets under `/teacher/print/*`
- [x] `الإعدادات → المعلمون` on the supervisor's side: accounts, daily points, halaqa weekdays

### 10.2a Client's pass over the running portal (18 Sep 2026)  ✅
Shown the working portal, the client reshaped it. Two of these changed the DATABASE, not the screen:

- [x] **«غائب بعذر» removed** — from the `AttendanceStatus` enum, the rules, the reports and the
      prints. It contradicts مع-٣-ب, which names four states; recorded as the client's decision in
      the migration, in `lib/teacher.ts` and in `DESIGN.md` §12.4
- [x] **`recitation_lines.note`** — a note per مقرّر, beside the passage it is about. §٩'s note on
      the DAY stays; they are two different remarks
- [x] **`teacher_alert_reads`** replaced `admin_message_reads` — five of the six alert kinds are
      computed from rows and had no id to mark, so the key is derived from the alert itself
- [x] الرئيسية rebuilt on the student's shapes: a ring and an attendance bar, the exam rail, five
      alerts with unread dots and a modal for the rest, the point ledger
- [x] التسجيل: the same hero as الرئيسية with the three modes inside it; search, `احفظ الكل` (one
      request), a `الحاضرون فقط` filter; one-row attendance; full مقرّر names; whole-block toggle;
      labelled errors; per-line note; recitation gated on attendance; re-press clears
- [x] وضع «يوم سابق» keeps its own date, and «اليوم» is always today
- [x] **The teacher can no longer set a مقرّر** — so `الإعدادات ← المعلمون ← مقرّرات الطلاب` was
      built for the supervisor, and `/api/admin/progress` behind it. Without it the teacher's
      «راجع المشرف» is a door nobody can open
- [x] No entrance animation on either portal's hero

### 10.2b Second pass over the running portal (18 Sep 2026)  ✅
- [x] **`DateField`** — the calendar drawn in the site's own identity instead of the operating
      system's, with the Hijri date the native control cannot show, day steppers, and `max` enforced
      on the grid, the month arrow and the steppers alike. Used by التسجيل, فترة لطالب and التقارير
- [x] Both portals' heroes: **one page** — no sticky, no parallax, no watermark, no climbing sheet
- [x] `.portal` wears the supervisor's `.thin-scroll` rather than hiding its scrollbar
- [x] **Clearing a saved day is a save**: the entry is deleted, its points come back as a reversing
      row (append-only holds), and the boy returns to the مقرّر that day recorded
- [x] The hero's big button is a stated prop, not inferred from `data` — it was flashing on التسجيل
      and sitting permanently in فترة لطالب
- [x] Recitation lines on one row with a 24px tick; sort chips toggle direction; ملف الطالب
      reorganised into a fact grid with print at the top, histories capped at 5 (ledger 10), and the
      read-only note replaced by a «صحّح أيامه» button that lands on فترة لطالب with the boy chosen
- [x] كشف حلقتي gained «مضى عليه» and «آخر اختبار»; تقارير الطالب الواحد removed from التقارير

### 10.2c Third pass over the running portal (18 Sep 2026)  ✅
- [x] **«امسح تسجيله» only at its time** — a card that WAS saved and has just been cleared, not every
      untouched card on the screen
- [x] **`نقاط يومه`** on the save row, at the start of it: the day's total for that boy, computed from
      the DRAFT by the same `dailyAward` the server pays by, over the point table the route now hands
      down with the day. Reverses §١٢-ب's «ولا نقاط ولا حسابات في هذه الصفحة» — DESIGN.md §12.5b
- [x] حال اليوم on a non-halaqa day is the headline alone; the paragraph's content is the button
- [x] The hero's bottom corners curve full-bleed; the section under it gets the ordinary entrance
- [x] The **document's** scrollbar wears the indicator (`html`, not `.portal` — a nested div cannot
      paint the page's own bar)
- [x] سجل التسميع: three equal boxes instead of wrapping pills, no subtitle, «صحّح السجل» on one line
- [x] **`<HijriText>`** — the one place `<Num>`'s forced LTR is wrong, and it was wrong in all four
      places a Hijri date appeared. DESIGN.md §12.5c
- [x] **التنبيهات**: every kind carries its date, ordered newest-first, and a **bell in the hero**
      beside خروج opens them all. Read-marking moved into `MeProvider`, since two things now show the
      same list. DESIGN.md §12.5d
- [x] **فرسان الأسبوع** in «ما يُرسل ويُعلَّق» — beside لوحة الشرف's term-long balances.
      DESIGN.md §12.6b
- [x] حركات النقاط on صفحة النقاط capped at ten, with «عرض الكل» opening the rest in a window

### 10.2d Fourth pass, and two things put back (18 Sep 2026)  ✅
- [x] **`Modal` is a sheet**: it rises from the edge it is anchored to, falls when dismissed, and can
      be **dragged away by the header**. Five phases, only arrival a keyframe — DESIGN.md §7.1
- [x] The **student's** hero gets the curved foot the teacher's has
- [x] **مقرّر اليوم is back on the student's home**, and **his plan grid opens on his own مقرّر with a
      tick on every one his teacher recorded**. Removed originally because nothing recorded where a
      boy stood; the teacher's portal records it, so it is his teacher's own save read back to him
      rather than a guess. DESIGN.md §11.3a and §11.4
- [x] **فرسان الأسبوع redefined to the client's own criteria** — الحضور، الثوب، التسميع كامل، في كل
      يوم حلقة مسجَّل خلال الأسبوع. A title, not a ranking. `knightOfWeek` in lib/teacher.ts with nine
      tests; `lib/knights.ts` read by BOTH sheets. DESIGN.md §12.6b
- [x] **A supervisor's sheet for the فرسان** — `/print/knights`, in التقارير beside لوحة الشرف, for
      one halaqa or the whole mosque
- [x] The bell's number is the **unread** count, and nothing when nothing is unread
- [x] **رسائل الإدارة at the supervisor's end** — `الإعدادات ← المعلمون`, with the recipients chosen
      by name, a read count on what was sent, and withdrawal. DESIGN.md §12.6c. This closes one of
      §10.3's open items

### 10.2e Fifth pass — a bug, a calendar, and two portals' polish (18 Sep 2026)  ✅
- [x] **A saved day keeps the مقرّر it recorded.** The card read the live pointer, so saving Tuesday
      made Tuesday show Wednesday's passages. `day_entries` already held the anchor and nothing read
      it. DESIGN.md §12.4a — the one real defect in this pass
- [x] **فرسان الأسبوع: a passed exam is a met day on its own** — «إذا اختبر واجتاز يُحسب ذلك اليوم».
      Three more tests; `lib/knights.ts` reads the exams beside the entries
- [x] **`DateRangeField`** — one calendar, first tap «من» and second «إلى», the range tinted between
      them, earlier taps re-choosing the start, and the FUTURE faded to 30%. Replaces the two fields
      on التقارير and on فترة لطالب. DESIGN.md §7.2
- [x] **`ScrollProgress`** — a white hairline across the top of both portals, filling from the right.
      DESIGN.md §7.3
- [x] The student's مسيرتي ring measures THIS LEVEL, not the whole track. DESIGN.md §11.3
- [x] وضع «فترة لطالب»: the picker is cards with the level and the مقرّر, search on top, staggered —
      and the chosen boy's name comes off all fourteen day cards. DESIGN.md §12.5a1
- [x] سجل التسميع on ملف الطالب is a WEEK, not a count of five
- [x] بوابة المعلم has a door on the sign-in page, beside the student's

### 10.2f Sixth pass — a dead button, a systemic width, and the student's bell (18 Sep 2026)  ✅
- [x] **«امسح تسجيله» did nothing in وضع «فترة لطالب»** — its save returned early on a card with no
      status, which is exactly what a cleared card is. DESIGN.md §12.5a2
- [x] **`INPUT_BARE`** — `cx(INPUT, 'w-20')` is a coin flip, and it had been losing: every narrow
      numeric box in الإعدادات rendered at the width of a paragraph. DESIGN.md §7.1a
- [x] **مقرّرات الطلاب rebuilt** as a list, and المعلمون tidied with it. DESIGN.md §12.5a3
- [x] **النقاط اليومية**: two typed columns instead of a multiplier, the factor now a button that
      fills the golden one (الحضور والثوب included), the notes removed, and the card moved to
      الإعدادات ← النقاط. Migration keeps an old database paying what it paid. DESIGN.md §12.6c1
- [x] **تنبيهات الطالب** — a bell on his card and a block under his exams: his teacher's notes from
      the recitation screen, his results, his bookings, his gifts, and the administration's
      messages. New `/api/student/alerts` + `student_alert_reads`. DESIGN.md §11.3b
- [x] **رسائل الإدارة**: its own settings page, **to students as well as teachers** (`audience`), and
      a door in the top bar of الرئيسية. DESIGN.md §12.6c
- [x] **`SlideRoute`** — the bottom bar and the in-page strips slide right and left. DESIGN.md §7.4
- [x] **No side scrollbar in the portals** at all; the top hairline is the one indicator.
      DESIGN.md §7.5
- [x] وضع «فترة لطالب»: the picker is cards on the page, and the «اعرض» button is gone
- [x] سجل التسميع is a week; the student's ring measures his level; بوابة المعلم has a door on the
      sign-in page *(carried from 10.2e and verified again here)*

### 10.2g Seventh pass — the mark, the talqeen boy, and the week on one sheet (18 Sep 2026)  ✅
- [x] **The page slide is reverted; the BAR's mark slides instead** — measured, pinned to the physical
      left edge, and read after commit rather than in a frame. DESIGN.md §7.4
- [x] **مسار التلقين: آخر سورة وآخر آية**, and «يبدأ من» on the next day's card — with the roll-over
      into the next surah. Two columns on the day and on the pointer; four tests. DESIGN.md §12.4b
- [x] **تقرير تسجيل المعلم** — a landscape week: students in rows, days in columns, four marks each,
      the day tinted by its status, «—» for absent, and a فارس column. DESIGN.md §12.6d
- [x] **الرسائل**: four ways to name the students (الكل · بالحلقة · بالمسار · بأعيانهم), a two-letter
      search with ↑↓ and Enter, and **one card per send** with its recipients. DESIGN.md §12.6c
- [x] **تصفير النقاط** — its own lever under صفحة النقاط, with the database reset's own confirm
- [x] «يستحق الاختبار» moved to the left of the card's own row, off its own line
- [x] مقرّرات الطلاب: a «صدّر خطته» button for a student without one, and the site's own halaqa list
      in place of the operating system's `<select>`
- [x] **Every date picker in the three portals is the site's own** — no `<input type="date">` left
- [x] The messages door moved from the top bar into «اختصارات»; the note at the foot of التقارير went

### 10.2h Eighth pass — one door, short lists, and the sheet that names the boy (18 Sep 2026)  ✅
- [x] **The three sign-in pages share one frame** — form on the right, ayah on the left, the curtain
      on all three, and two rectangles to the other portals. DESIGN.md §5.3
- [x] **قائمة السور بتصميم الموقع** in the talqeen card, with a تنبيه when what was typed is not one
      of the 114 — because the server drops it rather than storing it. DESIGN.md §12.4b
- [x] **الرسائل**: every teacher shown whole, and halaqat chosen SEVERAL at a time as rectangles with
      their counts — one send, one card, one withdrawal. DESIGN.md §12.6c
- [x] **تصفير النقاط** wears the database reset's own block, down to the warn strip and the red word
- [x] **تقرير تسجيل المعلم** gains المسار والمستوى والمقرّر, a narrower name, and `table-fixed` so the
      slack goes into the mark cells. DESIGN.md §12.6d

### 10.2i Ninth pass — the appointment book, the plan sheet, and a save that had stopped saving (18 Sep 2026)  ✅
- [x] **A bug found while verifying, and fixed**: `PUT /api/state` had been failing with a 500 since
      the first «امسح تسجيله» or «تصحيح حركة». `NOT { refType: 'day' }` is `<> 'day'` in SQL, which is
      UNKNOWN for NULL — so a row with no refType survived the delete and arrived again in the same
      save, colliding on its own id. The clear-correction now carries `refType: 'day'` (it IS a
      teacher row; only the refId had to go), the delete names NULLs explicitly, and a migration
      repairs the rows already written. **The supervisor could not save at all until this.**
- [x] **حجوزات الاختبارات**: filters by وقت (أُجري · اليوم · محجوز · أُلغي) and by وسام, a pencil that
      corrects a booking instead of cancelling it, and «في السجلّ» landing on the sitting itself.
      DESIGN.md §12.6e
- [x] **اختبار الجمعية is bookable**, and only for a boy §4.8 says is ready — «بعد الوسام الماسي
      للمستويات الذهبية جميعها، أو بعد الوسام الماسي للمستويات الفردية للمسار الفضي». Two tests state
      the rule in the client's own terms
- [x] **«يحتاج مراجعة قبل الاختبار»** — the teacher raises it, the supervisor sees it on the booking
      screen and in the follow-up lists, and the boy is told in his own portal. DESIGN.md §12.4c
- [x] **ورقة الخطة**: each مقرّر is one cell, the badge rows are three, and مرجع التجويد shrank so the
      sheet stays one page. DESIGN.md §8.1
- [x] **تقدّم الحلقات**: today's own figures on the home screen — same table, same columns — and the
      رتل term totals moved to a report. DESIGN.md §12.6f
- [x] **تاريخ الميلاد** in تسجيل طالب: three boxes, the month by name or number, February clamped
- [x] الأخطاء التجويدية joined the question rows in تفاصيل الاختبار; the note column became an icon
      with its text on hover; «حان موعد اختباره» and «اختبارات اليوم» count the DAY, not the backlog;
      the date fields wear the form's chrome (DESIGN.md §7.2a); «لست هنا؟» and the duplicate
      «تسجيل اختبار» button are gone

### 10.2j Tenth pass — الأوجه، والتصفية في البار، ومن ينتظر اختباره (18 Sep 2026)  ✅
- [x] **حسبة الأوجه** من ورقة «مسارات الحفظ»، في `settings.memorisation_pages` — لا في الشيفرة، ولا
      تُطبع تفاصيلها في أي شاشة. `lib/pages.ts` + اثنا عشر اختبارًا. DESIGN.md §12.6g
- [x] **عمودا «أوجه الحفظ» و«أوجه المراجعة»** في تقدّم الحلقات، محسوبان من السطور التي سُمِّعت اليوم،
      وتحتهما عدد من سمّع
- [x] **تصفية الحجوزات انتقلت إلى البار الجانبي** وصارت في الرابط (`?when=`, `?badge=`)
- [x] **«من يستحق اختبارًا»** قائمةً قائمة في بلوك اختبارات المعلم — بمن حُجز له ومن رُفع عنه «يحتاج
      مراجعة» — بدل تنبيهٍ يمرّ
- [x] زرّ الجاهزية أصفر، وقرص «يحتاج مراجعة» في صفحة طلابي

### 10.3 Still open
- [ ] **Answer needed on the daily point figures.** `settings.weekly_sheet_points` (seeded from the
      FIRST requirements document) and §١٣ of the third disagree on three of five items, and the
      first also answers the golden-doubling question the third leaves open. Both are shown side by
      side on the settings card with their totals; the supervisor picks. Until he does, §١٣ ships
- [ ] The supervisor's own copy of صفحة التسجيل, for the day a teacher is absent. The ROUTES already
      accept him (`/api/teacher/*` takes an admin session with `?halaqa=` and stamps the save
      `SUPERVISOR`); what is missing is the screen in بوابة الإدارة that calls them
- [ ] Phase two of §17: full multi-day offline with deferred sync, barcode attendance, the weekly
      summary that builds itself each Thursday, and direct WhatsApp send

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
