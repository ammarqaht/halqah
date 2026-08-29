# Halqah — Technical Specification

> **Audience:** the engineer/agent implementing this system.
> **Privacy:** every real name, national ID and phone number has been stripped from these
> documents. The client's four workbooks stay outside version control — they carry students'
> names, national IDs and guardians' phone numbers, and this repository is public.
> **Language:** English by design, so identifiers, schema and prose stay in one language.
> The **client-facing** document is Arabic: `متطلبات-نظام-حلقة.pdf` (source: `halqah-requirements.html`).
> **This file must never contradict that PDF.** If it does, the PDF wins and this file is fixed.
>
> Build order and task breakdown live in **`BUILD_PLAN.md`**. This file is *what*; that file is *when*.
> The visual system and application shell live in **`DESIGN.md`** — palette, typography, the rail +
> contextual panel, and the sign-in animation. That file overrides any UI hint given here in passing.

---

## 0. Sources of truth

Everything below is derived from these files. Do not invent domain facts — go read them.

| Source | Path | What to trust it for |
|---|---|---|
| Requirements (client-approved) | `متطلبات-نظام-حلقة.pdf` / `halqah-requirements.html` | Scope, screens, wording, decisions §13 |
| Circle database | `نسخة من  قاعدة بيانات الحلقات.xlsx` ⚠ *two spaces after «من»* | Student roster, exam log, Ratel export shape, weekly points sheet |
| Exams | `نسخة من الاختبارات.xlsx` | Exam records, exam sheet layout, level→juz table |
| Curriculum | `نسخة من منهج الحفظ.xlsx` | Full memorisation curriculum, printed plan layout, level-issue log |
| Dashboard | `نسخة من لوحة المعلومات.xlsx` | Output screens the client uses today (what our UI replaces) |
| Meeting transcript | `audio1033171519.docx` | Why decisions were made; client's own words |

### Client's current systems (out of scope, we integrate by file)
- **Ratel (رتل)** — association software. Teachers record daily recitation + attendance. Client exports an Excel report weekly/biweekly. **We never write to Ratel.**
- **Qiyas (قياس)** — association exam results source.
- **Tahfeez (تحفيز)** — the points program **we are replacing entirely**.

---

## 1. Domain glossary (Arabic ⇄ code)

Use these identifiers everywhere. Never transliterate ad hoc.

| Arabic | Identifier | Notes |
|---|---|---|
| حلقة | `Halaqa` | A circle: one teacher, one time slot |
| المعلّم / المسمِّع | `Teacher` | One teacher per halaqa |
| المسار | `Track` | enum: `TALQEEN` \| `SILVER` \| `GOLDEN` |
| المسار الفضي | `SILVER` | 60 levels, half a page/day, level = a *hizb* |
| المسار الذهبي | `GOLDEN` | 30 levels, one page/day, level = a *juz* |
| مسار التلقين | `TALQEEN` | **Classification only.** No curriculum, no levels, no points |
| المستوى | `level` | Integer, counts **down**: Silver 60→1, Golden 30→1 |
| عدد الأجزاء | `ajza` | Juz-equivalent of a level (see §4.2) |
| خطة الحفظ | `Plan` | The printed 24-working-day sheet for one level |
| درس | `DARS` | New memorisation for the day |
| م.ص | `MURAJAA_SUGHRA` | Near review |
| م.ك | `MURAJAA_KUBRA` | Far review |
| الوسام الذهبي | `BADGE_GOLDEN` | Internal exam, **day 12** of a level (half) |
| الوسام الماسي | `BADGE_DIAMOND` | Internal exam, **day 24** of a level (full) → advances to next juz |
| اختبار الجمعية | `ASSOCIATION` | External exam, results from Qiyas |
| اختبار تجريبي | `MOCK` | Practice before the association exam. **No points.** Appears as «تلقين» in client sheets — do not confuse with the Talqeen track |
| اختبار تجويد | `TAJWEED` | Scattered topic exams, not a levelled track |
| نقاط التحفيز | `points` | Student balance, spendable in the store |
| كود الشحن | `PointCode` | Unique single-use printed card |
| ثوب | `thobe` | Weekly-sheet item: attended wearing a thobe |

---

## 2. Platform & stack

**Hosting: [CranL](https://cranl.com)** — a Dockerfile-based PaaS. Confirmed capabilities (docs.cranl.com):
Git-based deploys from GitHub · managed **PostgreSQL / MySQL / MariaDB / MongoDB / Redis** · regions **Europe, USA, MENA, Asia** · built-in CDN + SSL · custom domains · **S3-compatible object storage** with credentials · traffic analytics · **cron jobs** · team roles · CLI + MCP.

### Decisions

| Concern | Decision | Why |
|---|---|---|
| Region | **MENA** | Users are in Dammam. Lowest RTT; the client's stated priority is speed |
| Runtime | **Next.js (App Router) + TypeScript**, `output: 'standalone'`, custom `Dockerfile` | CranL builds from a Dockerfile. `standalone` keeps the image small and cold starts short |
| Database | **PostgreSQL** (CranL managed) | Real constraints, partial indexes, `generated` columns, window functions for the follow-up screens |
| ORM | **Prisma** | Already used in `Nibras` and `Attendance`. Migration story is the best fit for a schema that will churn. At ~10³ rows the ORM is never the bottleneck — indexes are |
| Auth | **Custom: `bcryptjs` + `jose` JWT in an httpOnly cookie** | No Supabase here. `Attendance/lib/auth.ts` already does exactly this, including national-ID login for students |
| File storage | **CranL S3 bucket** (`@aws-sdk/client-s3`) | Gift images only. Keep DB free of blobs |
| Excel parsing | **`xlsx` (SheetJS)** | Used in `Nibras` + `Attendance`. Handles the Ratel export's junk header rows and merged cells; `read-excel-file` is stricter than this data allows |
| Barcode | **`qrcode`** (generate) + **`html5-qrcode`** (scan) | Both already in Medad projects |
| Printing | **CSS `@page` print stylesheets** — no PDF library | Same technique that produced the requirements PDF. Renders Arabic RTL perfectly, zero dependency |
| Background jobs | **CranL cron** hitting a protected route | Nightly alert recomputation |
| Styling | Tailwind, RTL-first (`dir="rtl"` on `<html>`) | Use logical properties (`ms-`/`me-`), never `left`/`right` |
| Fonts | `thmanyah sans` (body) + `thmanyah serif display` (headings), self-hosted `.otf` → `.woff2` | Brand fonts, already in the repo tree. Subset to Arabic + Latin digits |

### Project shape
```
app/
  (auth)/login/
  admin/          overview · students · halaqat · points · store · plans · exams · follow-up · reports · settings
  student/        home · redeem · store · my-level
  api/            REST route handlers
  print/          print-only routes (plan, reports, code cards)
lib/
  auth.ts         session, hashing, guards
  db.ts           PrismaClient singleton
  rules.ts        §4 — pure functions, unit-tested
  importers/      ratel.ts · qiyas.ts · roster.ts · curriculum.ts
  s3.ts
prisma/schema.prisma
scripts/seed/     one-off importers for the four workbooks
```

### Non-functional targets
- Admin list screens: **one indexed query**, no N+1. TTFB < 200 ms in-region.
- Student portal: server-rendered, < 100 KB JS on first load. It runs on kids' phones over mosque wifi.
- Every mutation is a POST/PATCH route handler inside a **single DB transaction**.
- All money-like operations (points, stock, code redemption) use `SELECT … FOR UPDATE` or a unique constraint — never read-then-write.
- Scale reality: ~103 students, 7 halaqat, ~500 exams, ~6k curriculum rows. This is small. "Fast" here means *no accidental N+1 and correct indexes*, not exotic caching.

---

## 3. Data model

Postgres. All tables `snake_case`, all PKs `id bigserial` unless noted. Every table gets `created_at timestamptz default now()`.
Single organisation — **mosque and time-slot are plain text columns on `halaqat`**, not tables (client decision).

### 3.1 People & structure

```
teachers
  id, full_name text not null, phone text, active bool default true

halaqat
  id
  name           text not null          -- «تحفيظ حسن محمد ماهر علي (العصر)»
  teacher_id     → teachers.id
  mosque         text not null          -- «جامع محمد العبدالكريم حي أحد»
  time_slot      text not null          -- «العصر» | «المغرب» …
  notes          text
  active         bool default true
  index (mosque, time_slot), index (teacher_id)

students
  id
  full_name      text not null
  national_id    text                   -- indexed, NOT unique — see note below
  national_id_flag text NULL            -- 'SHORT' | 'LONG' | 'DUPLICATE' — informational only
  track          track_enum not null    -- TALQEEN|SILVER|GOLDEN
  halaqa_id      → halaqat.id NULL      -- NULL = «طالب بلا حلقة» → alert
  grade          text                   -- «ثالث متوسط»
  stage          text                   -- ابتدائي|متوسط|ثانوي|تلقين
  nationality    text                   -- سعودي | غير سعودي  (association stat)
  guardian_phone text
  status         student_status default 'ACTIVE'   -- ACTIVE|INACTIVE|GRADUATED
  current_level  int NULL               -- NULL for TALQEEN
  joined_at      date
  index (halaqa_id), index (track), index (status), index (national_id)
  partial index (halaqa_id) where halaqa_id is null

halaqa_transfers
  id, student_id, from_halaqa_id NULL, to_halaqa_id, reason text, moved_at, moved_by
```

> **`national_id`: the minus sign is an Excel artefact — strip it.** Every value in the roster is stored negative. Verified against the Qiyas export (which stores the same IDs positive): **33 students cross-matched, 0 mismatches.** So `abs(value)` recovers the true document number.
>
> After `abs()`, 93 of 101 are valid 10-digit numbers, and the leading digit is meaningful:
> | Leading digit | Meaning | Count |
> |---|---|---|
> | `1` | Saudi national ID | 54 — **all 48 «سعودي» students, without exception** |
> | `2` | Iqama (residency) | 25 |
> | `3` / `4` | Border/visa number (newly-arrived residents) | 17 |
> | other | see below | 2 |
>
> Store as `text`, zero-padded, never as a number — leading zeros and 10-digit values do not survive JS `number`.

**Import every value exactly as it is.** Client instruction: «دخلها زي ما هي عليه». Do **not** validate length, do **not** null anything out, do **not** guess a missing digit. Eight students carry short or over-long numbers — they are entered as found:

Eight records carry short or over-long numbers (4, 5, 5, 7, 8, 8, 8 and 11 digits).
They are entered as found and flagged `SHORT` / `LONG` for the supervisor to correct.
Six of the eight cluster in two families and one halaqa, which reads like a run of
data-entry slips rather than random corruption — worth mentioning when asking for
corrections. *(The names sit in the client's roster, not in this repository.)*

> ⚠ **`national_id` is therefore indexed but NOT unique.** The roster contains **one real collision**: a single student name appears twice on one ID with the *same* guardian phone but a *different* halaqa and grade — the earlier row showing the previous school year. That reads like a stale row from last year rather than two brothers — but we do not decide that for the client. **Import both rows as two student records** and raise a "duplicate ID" item for the supervisor to merge or correct in the UI.
>
> Consequence for login: uniqueness lives on `student_credentials.login_id`, not on `students.national_id`. `login_id` defaults to the national ID; where a collision or a duplicate makes that impossible, the system issues a short code and the supervisor hands it out.

Also skip the trailing `المجموع` (totals) row in the sheet — it parses as a student with no ID.

### 3.2 Curriculum (reference data — seeded, rarely changes)

```
curriculum_levels
  id, track track_enum, level int, ajza int
  unique (track, level)

curriculum_days
  id
  track track_enum, level int, day_no int          -- 1..24
  kind  plan_kind_enum                             -- DARS|MURAJAA_SUGHRA|MURAJAA_KUBRA
  from_surah text, from_ayah text                  -- text: values include «أخ» = end of surah
  to_surah   text, to_ayah   text
  note text
  is_exam_day bool default false
  exam_badge  exam_type_enum NULL                  -- BADGE_GOLDEN on day 12, BADGE_DIAMOND on day 24
  unique (track, level, day_no, kind)
  index (track, level)
```

Facts verified against `نسخة من منهج الحفظ.xlsx`:
- Sheet `فضي`: 3741 rows, levels **60→40 only (21 levels)**.
- Sheet `ذهبي`: 2161 rows, levels **30→1 (all 30)**.
- **Every level in both tracks has exactly 24 days.**
- Day 12 row = `الوسام الذهبي`; day 24 row = `الوسام الماسي` (+ `اختبار الجمعية`) — these carry a date field, not a recitation range.
- Ayah values are sometimes the literal string `أخ` / `اخ` / `آخ` (= last ayah). **Normalise to `"آخر"` on import, keep as text.**
- Surah `محمد` appears as `ﷴ` (U+FDF4 ligature) in the file. Normalise on import.

> ⚠ **Known data gap:** silver levels **39→1 do not exist** in the client's file. Current silver students sit between level 45 and 60, so this does not bite today — but plan printing will fail the day a silver student reaches level 39. Surface it as a blocking, explicit error, never a blank page. Tracked in §9.

### 3.3 Plans issued to students

```
student_plans
  id, student_id, track, level
  issued_at    timestamptz not null    -- «متى أعطيته الورقة» — feeds the "late" alert
  issued_by    → admin_users.id
  is_customised bool default false
  printed_count int default 0
  index (student_id, issued_at desc)

student_plan_days            -- only rows that differ from curriculum_days
  id, student_plan_id, day_no, kind, from_surah, from_ayah, to_surah, to_ayah, note
  unique (student_plan_id, day_no, kind)
```

**Resolution rule:** a plan renders as `curriculum_days` LEFT JOIN `student_plan_days` — the override wins per (day, kind). This is what makes "لا يُفقد الأصل أبدًا" true: deleting the override rows restores the original.

Editing scope (`إد-٥-أ` in the PDF):
- *This student only* (default) → write `student_plan_days`.
- *Everyone on this level* → write `curriculum_days`, require a second confirmation, and write an `audit_log` row.

### 3.4 Exams

```
exams
  id
  student_id, halaqa_id, track            -- denormalised at time of exam (halaqa can change later)
  type          exam_type_enum            -- BADGE_GOLDEN|BADGE_DIAMOND|ASSOCIATION|MOCK|TAJWEED
  taken_on      date not null
  level         int NULL
  ajza          int NULL
  errors        int NULL
  warnings      int NULL                  -- «التنبيهات»
  tajweed_errors int NULL
  score         numeric(5,2) NULL         -- out of 100
  passed        bool NULL
  points_awarded int default 0
  points_paid   bool default false        -- «نقاط تحفيز» checkbox in the client's sheet
  note          text
  examiner      text                      -- association exams
  tajweed_topic_id → tajweed_topics.id NULL
  source        exam_source               -- MANUAL|QIYAS_IMPORT|ONSITE
  index (student_id, taken_on desc), index (type, taken_on), index (halaqa_id)
  partial index (student_id) where passed and not points_paid   -- «اجتاز ولم تُصرف نقاطه» alert

exam_questions               -- on-site exam sheet, one row per question
  id, exam_id, seq int
  surah text, ayah_from text, ayah_to text
  errors int default 0, warnings int default 0, tajweed_errors int default 0
  note text
  unique (exam_id, seq)

tajweed_topics               -- admin-managed list; seeded with «النون الساكنة والتنوين»
  id, name text unique, active bool default true
```

Verified counts in `نسخة من الاختبارات.xlsx`: 172 `BADGE_GOLDEN`, 157 `ASSOCIATION`, 139 `BADGE_DIAMOND`, 47 `TAJWEED`.

### 3.5 Points

```
point_transactions           -- append-only ledger. NEVER update or delete a row.
  id, student_id
  delta        int not null              -- signed
  kind         txn_kind                  -- MANUAL|CODE|EXAM|PURCHASE|REFUND|CORRECTION
  reason       text not null             -- required, drives reports
  ref_type     text NULL, ref_id bigint NULL   -- exam_id / order_id / point_code_id
  created_by   → admin_users.id NULL     -- NULL when the student redeemed a code
  created_at   timestamptz default now()
  index (student_id, created_at desc), index (kind, created_at)

point_code_batches
  id, value int, purpose text, quantity int
  expires_at timestamptz NULL, revoked_at timestamptz NULL
  created_by, created_at

point_codes
  id, batch_id, code text unique         -- random, NOT sequential
  redeemed_by → students.id NULL, redeemed_at timestamptz NULL
  partial unique index (id) where redeemed_by is null    -- helper for stock counts
  index (batch_id)
```

**Balance** = `SUM(delta)` over `point_transactions` for the student. Do not keep a mutable balance column; if a hot path ever needs it, add a `MATERIALIZED VIEW` refreshed on write — not a hand-maintained integer.

**Code redemption is the one genuine race condition in this system.** Implement as a single statement:
```sql
UPDATE point_codes SET redeemed_by = $student, redeemed_at = now()
WHERE code = $code AND redeemed_by IS NULL
  AND (SELECT revoked_at FROM point_code_batches b WHERE b.id = batch_id) IS NULL
  AND (expires_at IS NULL OR expires_at > now())
RETURNING id, (SELECT value FROM point_code_batches b WHERE b.id = batch_id);
```
Zero rows returned → already used / invalid / expired / revoked. Only on a returned row do you insert the `point_transactions` record — same transaction.

**Code format:** 10 chars, Crockford base32 (no `I O U 1 0` — kids read these off paper). Generated with `crypto.randomBytes`, uniqueness enforced by the DB, retry on conflict.

### 3.6 Store

```
gifts
  id, name text, description text, image_key text          -- S3 object key
  points_cost int not null, quantity int not null
  low_stock_threshold int default 3
  category text, status gift_status default 'VISIBLE'      -- VISIBLE|HIDDEN
  index (status)

orders
  id, student_id, gift_id
  points_spent int not null                                -- snapshot; gift price may change later
  gift_name_snapshot text not null
  status order_status default 'PENDING'                    -- PENDING|DELIVERED|CANCELLED
  created_at, delivered_at, cancelled_reason text
  index (status, created_at), index (student_id)
```

**Purchase** = one transaction: check balance → `UPDATE gifts SET quantity = quantity - 1 WHERE id = $g AND quantity > 0 AND status='VISIBLE'` (0 rows ⇒ abort) → insert `orders` → insert `point_transactions(delta = -cost, kind='PURCHASE', ref=order)`.
**Cancel** = restore quantity + insert `REFUND` transaction. Never delete the order.

### 3.7 Imported snapshots

```
ratel_imports
  id, imported_at, imported_by, file_name, row_count, snapshot_date date

ratel_rows
  id, import_id, student_id NULL           -- NULL = unmatched, shown to the admin
  raw_name text, raw_national_id text
  attended bool
  today_curriculum text                    -- «الحفظ: 15  المراجعة: 22»
  hifz_from_to text, hifz_required text
  hifz_lines numeric, hifz_pages numeric, hifz_ajza numeric, hifz_score numeric, hifz_index numeric
  review_from_to text, review_required text
  review_lines numeric, review_pages numeric, review_ajza numeric, review_score numeric, review_index numeric
  hifz_teacher text, review_teacher text
  index (import_id), index (student_id)

qiyas_imports / qiyas_rows        -- same pattern, feeds `exams` with source=QIYAS_IMPORT

audit_log
  id, actor_id, action text, entity text, entity_id bigint,
  before jsonb, after jsonb, at timestamptz default now()
  index (entity, entity_id, at desc)
```

Every edit to a score, a student record, or curriculum writes here — client decision §13.10: *«نعم يُسجَّل كل تعديل»*, and *«لا توجد مدة يُقفَل بعدها التعديل»*.

### 3.8 Auth & settings

```
admin_users
  id, full_name, username text unique, password_hash text, role admin_role default 'SUPERVISOR', active bool

student_credentials
  student_id PK → students.id
  login_id text unique                      -- national ID, or a system-issued short code
  password_hash text
  must_change bool default false
  last_login_at timestamptz

settings                                    -- single-row-per-key config, editable in the UI
  key text PK, value jsonb, updated_at, updated_by
```

Seeded `settings` (all from §13 decisions — **never hard-code these in application code**):
```json
{
  "passing_score": 80,
  "score_deductions": { "error": 2, "warning": 0.5, "tajweed_error": 1 },
  "exam_points": {
    "SILVER": { "BADGE_GOLDEN": 50,  "BADGE_DIAMOND": 100, "ASSOCIATION": 200 },
    "GOLDEN": { "BADGE_GOLDEN": 100, "BADGE_DIAMOND": 200, "ASSOCIATION": 200 }
  },
  "weekly_sheet_points": {
    "SILVER": { "attendance": 10, "thobe": 10, "dars": 2.5, "ms": 2.5, "mk": 5 },
    "GOLDEN": { "attendance": 20, "thobe": 10, "dars": 5,   "ms": 5,   "mk": 10 }
  },
  "level_expected_days": 24,
  "level_late_after_days": 35,
  "ratel_stale_after_days": 14,
  "default_exam_questions": 5
}
```

---

## 4. Rules engine (`lib/rules.ts`)

Pure functions. No DB access. **Unit-test every one of these** — they encode client decisions and a silent bug here corrupts every screen.

### 4.1 Level progression
```ts
nextLevel(track, level) => level - 1        // both tracks count DOWN
```
Silver 60→1, Golden 30→1. The system **suggests**; the supervisor decides. Never auto-advance a student.

### 4.2 Level → juz count (exact, from `قائمة المستويات`)
```ts
ajzaForLevel(SILVER, level) => (61 - level) / 2   // 59→1, 57→2, 55→3 … 1→30 (odd levels only)
ajzaForLevel(GOLDEN, level) => 31 - level         // 30→1, 29→2 … 1→30
```
Silver even levels sit mid-juz and have no whole-juz value — return `null`, do not round.

### 4.3 Exam days within a level
```
day 12 → BADGE_GOLDEN   (half the level)
day 24 → BADGE_DIAMOND  (the whole level; passing it advances to the next juz)
```
Both are movable per plan (`student_plan_days`), but these are the defaults and they come straight from the curriculum file.

### 4.4 Score from error counters
```ts
score = 100 - 2*errors - 0.5*warnings - 1*tajweedErrors      // clamp to [0, 100]
```
Weights come from `settings.score_deductions`. **Does not vary with the number of juz examined** (§13.4). Supervisor may override the computed score before approving.

### 4.5 Pass
```ts
passed = score >= settings.passing_score            // 80, same for every exam type
```
Overridable manually.

### 4.6 Exam points
Look up `settings.exam_points[track][examType]`.
- `MOCK` → **always 0**.
- `TAJWEED` → manual entry (the client's sheet stores a free number, 10–100).
- `TALQEEN` track → **0, always**. Talqeen students are outside the points system entirely (§13.1).

### 4.7 Golden-track doubling
Golden = double Silver on every item **except `thobe`, which is flat**. Association-exam points are **equal for both tracks** (external exam).
This is already baked into the `settings` values above; the rule exists so the *weekly sheet* (phase 2) derives correctly rather than hard-coding a second table.

### 4.8 Ready for the association exam
```ts
readyForAssociation(student) =
      completedWholeJuz(student)                     // level maps to a whole juz
  &&  passedDiamondBadgeForThatJuz(student)
  &&  !alreadyExaminedByAssociationOn(that juz)
```
Both conditions together — §13.6.

### 4.9 Late on level
```ts
isLate(plan) = daysSince(plan.issued_at) > settings.level_late_after_days   // 35
```
Basis: a level is 24 *working* days ≈ 5 weeks of circle days. This is the alert the client tracks by hand today: «أعطيته ٢٦ في شهر ٧، المفروض ينتقل خلال شهر».

### 4.10 Points balance
```ts
balance = Σ delta over point_transactions
```
Structurally impossible to drift from its ledger. Corrections are new rows (`kind='CORRECTION'`), never edits.

### 4.11 Talqeen exclusions
A `TALQEEN` student:
- appears in rosters, halaqat, and all association statistics (nationality/stage counts);
- has **no** level, **no** plan, **no** points, **no** store, and no points-related alerts.
Enforce at the DB layer where possible (`current_level` NULL) and guard in every points mutation.

### 4.12 Who may edit
`SUPERVISOR` only. **No edit window** — data stays editable indefinitely. Every edit writes `audit_log` (§13.10).

---

## 5. Import pipelines (`lib/importers/`)

All importers share one contract:
```
parse(file) → { rows, warnings }        // pure, no DB
match(rows) → { toCreate, toUpdate, unmatched }
preview()                               // ALWAYS shown before commit
commit()                                // single transaction
```
**Nothing is ever written without an explicit preview + confirm.** Imports **never delete** — a student missing from a new file raises "did they leave?", the admin decides.

### 5.1 Ratel weekly report → `ratel_rows`
Source sheet: `تفريغ البيانات من رتل` (and the same shape in `لوحة المعلومات` → `قاعدة البيانات من رتل`).

Real-world messiness to handle:
- Row 1 is a banner (`التقرير الشامل … مسجد:`), row 2 is the real header. **Find the header row by locating the cell `اسم الطالب`** — never assume a fixed offset.
- Column A carries an export date on some rows and is blank on the rest.
- Columns may be reordered or extra columns added. Match **by Arabic header text**, not position.

Header → field map (27 columns observed):
| Arabic header | Field |
|---|---|
| `اسم الطالب` | `raw_name` |
| `الهوية` | `raw_national_id` |
| `الحضور` | `attended` (1/0) |
| `المسجد` | halaqa mosque (informational) |
| `الحلقة` | halaqa name → match `halaqat.name` |
| `الصف` | `students.grade` |
| `منهج اليوم` | `today_curriculum` |
| `جوال ولي الأمر` | `students.guardian_phone` |
| `الجنسية` | `students.nationality` |
| `بداية ونهاية الحفظ` | `hifz_from_to` |
| `المطلوب حفظه` | `hifz_required` |
| `الحفظ بالاسطر` / `بالأوجه` / `بالاجزاء` | `hifz_lines` / `hifz_pages` / `hifz_ajza` |
| `درجة الحفظ` / `مؤشر الحفظ` | `hifz_score` / `hifz_index` |
| `معلم الحفظ` | `hifz_teacher` |
| …same six for المراجعة | `review_*` |

Normalisation on every import:
- Collapse internal whitespace in names (`أسامة  مصطفى` → `أسامة مصطفى`) — the file is full of double spaces.
- Strip Arabic diacritics and normalise `أ إ آ → ا`, `ى → ي`, `ة → ه` **for matching only**; store the original.
- Phones: strip non-digits, drop a leading `966`/`0`, store 9 digits.
- Teacher prefix `1) ` appears in Ratel teacher fields — strip it.

Matching order: `national_id` → exact normalised name → fuzzy name within the same halaqa (report as "needs review", never auto-apply).

### 5.2 Qiyas export → `exams` (`source = QIYAS_IMPORT`)
Sheet `تفريغ البيانات من قياس`, 12 columns:
`الحلقة · أسم الطالب · عدد الأجزاء · الدرجة النهائية · النتيجة النهائية · تاريخ الإختبار · رقم الهوية · نوع الإختبار · أسم المشرف · سبب عدم الإتمام · ملاحظات المشرف`

- `النتيجة النهائية` ∈ {`ناجح`, `لم يجتاز`} → `passed`.
- `سبب عدم الإتمام` e.g. `لم يحضر الطالب` → keep in `note`, set `score = null` (do **not** store the 0 the sheet contains — it is not a real score).
- Deduplicate on `(student_id, taken_on, type='ASSOCIATION')`.

### 5.3 Roster import → `students`
Sheet `قاعدة بيانات` in `قاعدة بيانات الحلقات.xlsx` (20 columns, 985 rows / 103 real students).

ID handling (see §3.1): `national_id = abs(value)` stored as a **string, exactly as found** — no length validation, no rejection, no padding beyond stripping the sign. Set `national_id_flag` for information only (short / long / duplicate) so the supervisor can see them; it never blocks an import. Drop the trailing `المجموع` row.

Row counts to expect: **103 name rows → 102 students after dropping `المجموع` → 101 distinct IDs** (one duplicated).
Also supports **paste-a-block-of-text** input (§إد-٣-أ, method 2): TSV/CSV from a clipboard, same parser downstream.

### 5.4 Curriculum seed (one-off, `scripts/seed/curriculum.ts`)
Sheets `فضي` (3741 rows) and `ذهبي` (2161 rows), 8 columns:
`المستوى · اليوم · المقرر · من سورة · آية · الى سورة · آية · ملاحظة`

- `المقرر` ∈ {`درس`, `م.ص`, `م.ك`} → `plan_kind_enum`.
- Rows where `من سورة` = `الوسام الذهبي` / `الوسام الماسي` → `is_exam_day = true`, `exam_badge` set, ranges NULL.
- Also seed the printed sheet's **tajweed footer** (أحكام النون الساكنة والتنوين، حروف القلقلة، حروف الغنّة) — it is part of the printed plan, sheet `خطة الحفظ` rows 81–87.

### 5.5 Level-issue history seed
Sheet `قاعدة بيانات متابعة خطة الحفظ` (984 rows): `اسم الطالب · المسار · المستوى · معلم الحلقة · التاريخ` → `student_plans`.
Observed ranges: Silver levels 45–60, Golden levels 14–30. Feeds the "late on level" alert from day one.

---

## 6. Admin portal

Route prefix `/admin`. Guard: `SUPERVISOR` session or 302 to `/login`.
Screen IDs match the client PDF so feedback maps 1:1.

### 6.1 `إد-٢` Overview — `/admin`
Four blocks, one page, server-rendered.

1. **Counters** — students (total/active), halaqat + teachers, track split, points granted vs spent this month, exams this month + pass count, count ready for association.
2. **Alerts** — each links to its target:
   | Alert | Query |
   |---|---|
   | Student with no halaqa | `students where halaqa_id is null and status='ACTIVE'` |
   | Late on level | latest `student_plans` per student, `issued_at < now() - 35d` |
   | Ready for association | rule §4.8 |
   | Passed but points unpaid | `exams where passed and not points_paid and points_awarded > 0` |
   | Not examined in N days | `max(taken_on)` per student |
   | Gift low on stock | `gifts where quantity <= low_stock_threshold and status='VISIBLE'` |
   | Orders awaiting delivery | `orders where status='PENDING'` |
   | Ratel data stale | `max(ratel_imports.imported_at) < now() - 14d` |
3. **Halaqa progress table** — per halaqa: students, avg `hifz_pages` / `review_pages` from the latest Ratel import, exams passed, attendance %.
4. **Shortcuts** — print a plan · record an exam · issue codes · upload Ratel.

Compute alerts in **one SQL round-trip** (CTEs), and recompute nightly via CranL cron into a small `alerts_cache` table if the page ever slows.

### 6.2 `إد-٣-أ` Students — `/admin/students`
Table: name · national ID · track · halaqa · grade · stage · nationality · guardian phone · current level · plan issued date · balance · status.
Search by name (partial, normalised) or ID. Filters: halaqa, track, stage, status, level range. Export the current filter to Excel.

Add: (1) upload Excel, (2) paste text, (3) manual form. All three funnel into §5.3.

**Student page** `/admin/students/[id]` — the replacement for the client's `البحث باسم الطالب` sheet:
personal data · level timeline (each level, issue date, days held) · exam history · points ledger · latest Ratel hifz/review/attendance · actions (print plan, print report, add points, record exam, transfer).

### 6.3 `إد-٣-ب` Halaqat — `/admin/halaqat`
Cards per halaqa. Create/edit (name, teacher, **time slot**, **mosque**, notes). Assign students via two-list transfer, multi-select. Transfer keeps all history and writes `halaqa_transfers`; if the transfer implies a track change, warn — never change the track silently.

### 6.4 `إد-٤-أ` Points — `/admin/points`
Balances table (sortable by balance, filter by halaqa). Add points to: one student · selected students · a whole halaqa. **Reason is required.** Negative deltas allowed. Ledger view with filters. Talqeen students are excluded from every path here.

### 6.5 `إد-٤-ب` Codes — `/admin/points/codes`
Issue a batch: value · quantity · purpose · optional expiry. Generate unique codes (§3.5). Print view at `/print/codes/[batchId]` — cards with logo, value, human-readable code, and a QR, sized for scissors, colour-coded by value.
Batch table shows used/remaining. Revoke a batch → all unredeemed codes die instantly.

### 6.6 `إد-٤-ج` Store — `/admin/store`
Gift CRUD with image upload to S3, points cost, quantity, low-stock threshold, visibility, category.
Orders table with a "delivered" action, and a printable pick-list grouped by halaqa. Cancelling refunds points and restores stock.

### 6.7 `إد-٥-أ` Plans — `/admin/plans`
Search student → track/halaqa/**next level** resolve automatically (the supervisor does **not** pick the level; §إد-٥-أ) → preview → **print, which saves `issued_at` in the same action**.

Editing before print (§إد-٥-أ, "تعديل الخطة وإضافة السور"): edit any day's ranges, add surahs, add/remove days (renumber automatically), move the exam days, change the daily amount, per-day note. Save *for this student* (default) or *for the whole level* (extra confirm + audit). "Restore original" button always present.

Bulk print for multiple students into one document.

### 6.8 `إد-٥-ب` Record exam — `/admin/exams/new`
Form per §3.4. Student search auto-fills track/halaqa/teacher. `ajza` suggested from level via §4.2. `passed` suggested from score via §4.5. Points suggested from §4.6 — awarding writes the `point_transactions` row **in the same transaction** as the exam.
Qiyas import lives at `/admin/exams/import`.

### 6.9 `إد-٥-ج` On-site exam — `/admin/exams/onsite`
Booking list, then the exam screen: a table with **one row per question** — surah field (suggest surahs inside the student's level, free text allowed) + three tap-counters (errors / warnings / tajweed errors) + note.
**Question count is not fixed:** starts at `settings.default_exam_questions`, and add/remove a question with one tap; renumber and recompute live. Score computed by §4.4, editable. One "approve" writes everything.

### 6.10 `إد-٥-د` Follow-up — `/admin/follow-up`
By halaqa (replaces the client's `البحث بالحلقة` sheet): name · grade · attendance · today's hifz · level · issue date · days held · last association exam (date/ajza/result) · last internal exam (date/type/level/score/note). Students with no plan render "لا توجد خطة", not blanks.
Ready-made lists: ready for association · late on level · not examined recently · top performers.

### 6.11 `إد-٥-هـ` Reports — `/admin/reports`
Every report is a `/print/*` route with a print stylesheet. Phase-1 set: plan sheet · full student report · teacher's halaqa report (association-examined students shaded — replaces manual green highlighting) · association statistics (counts, nationality, stage) · ready-for-exam list · code cards · gift pick-list · halaqa points list.

---

## 7. Student portal

Route prefix `/student`. Mobile-first, RTL, big touch targets — the users are 6–18 year olds on phones.

| Screen | Route | Content |
|---|---|---|
| `طا-١` Login | `/login` | Login ID + password. **No self-registration.** Accounts created by the admin |
| `طا-٢` Home | `/student` | Balance (large) · redeem button · current track/level/ajza · progress bar · last exams · recent points ledger |
| `طا-٣` Redeem | `/student/redeem` | One big input + **camera scan** (`html5-qrcode`). Clear success/failure messages: used / invalid / expired. Rate-limit failures per student |
| `طا-٤` Store | `/student/store` | Gift cards; unaffordable ones dimmed with "تحتاج N نقطة إضافية" (motivating, not hidden); out-of-stock labelled; confirm → instant deduction → order number. `/student/orders` for history |
| `طا-٥` My level | `/student/my-level` | Track, level, daily amount, issue date; the full 24-day plan with today highlighted; exam days 12 & 24 marked; my exams; next level preview |

Talqeen students: no points, no store, no plan. Their portal shows profile + exams only — **and see §9(a): we may not create accounts for them at all.**

---

## 8. Auth, security, operations

- Passwords: `bcryptjs`, cost 12. Sessions: `jose` JWT, httpOnly + Secure + SameSite=Lax cookie, 7-day sliding expiry, separate `aud` for `admin` vs `student`.
- Login throttling: exponential backoff per identifier + IP. Generic error text — never reveal which field was wrong.
- Student accounts are **created in bulk** when the roster is imported (§13.7 — "دفعة واحدة"), with printable credential sheets for the teachers. Admin can reset any password.
- Authorisation is enforced **server-side in every route handler**. A student may only ever read their own rows — assert `session.studentId === row.student_id`, never trust a client-supplied id.
- Uploads: validate MIME + magic bytes, cap at 5 MB, store under a random key. Only images, only for gifts.
- Secrets via CranL environment variables. Nothing in the repo.
- Backups: nightly `pg_dump` to the S3 bucket via CranL cron; verify restore before go-live.
- No sensitive personal data is stored (§13.11): name, ID, guardian phone, grade, nationality — nothing more.
- Students are never deleted (§13.12): `status = 'INACTIVE'`.

---

## 9. Open questions & standing assumptions

Each has a **working default** so implementation is never blocked. Revisit with the client; changing any of them is a settings edit, not a rewrite.

| # | Question | Working assumption |
|---|---|---|
| a | Do Talqeen students get portal accounts at all, given they have no points and no plan? | **Create the student row, skip the login account.** Create it when they move to Silver |
| b | Does attendance (`ح`) really double for Golden, or is it flat like `thobe`? | Taken literally: **attendance doubles (20)**. Lives in `settings.weekly_sheet_points` — a one-line change |
| c | When is the mock (`MOCK`) exam held, and by whom? | **On demand**, recorded like any other exam, no fixed plan day, zero points |
| d | Does passing the Diamond badge alone advance the student, or is the association exam also required? | **Diamond alone advances**; the association exam is recorded separately and does not gate progression |
| e | ~~IDs corrupt~~ **Resolved:** the minus is an Excel artefact; `abs()` gives the true ID, cross-verified against Qiyas. Client: import everything as-is | **Student login = national ID** via `student_credentials.login_id`. Short/long IDs are accepted verbatim. The one duplicated ID gets a system-issued code for the second record until the supervisor merges or corrects |
| f | Silver curriculum levels 39→1 are missing from the client's file | **Client accepts the gap.** Seed what exists; when a silver student reaches level 39, fail with an explicit Arabic message naming the missing level — never a blank sheet. Request the missing pages then |
| g | Are the `thmanyah` fonts licensed for web embedding? | Self-host and subset; confirm the licence before public launch |

---

## 10. Definition of done (phase 1)

- [ ] The supervisor can do a full working day without opening Excel: print a plan, record an exam, issue codes, add points, deliver a gift, print the teacher report.
- [ ] A student can log in, redeem a card, buy a gift, and see their level and plan.
- [ ] All four workbooks are seeded and reconcile against the originals (row counts + spot checks).
- [ ] Every rule in §4 has unit tests.
- [ ] No screen issues more than one query per logical list.
- [ ] Deployed on CranL (MENA), custom domain, SSL, nightly backup verified.
