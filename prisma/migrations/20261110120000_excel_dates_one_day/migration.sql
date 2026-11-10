-- تواريخ الإكسل — ١٠ نوفمبر ٢٠٢٦.
--
-- Every date read from an Excel date cell landed one day early: SheetJS gives
-- local midnight against the 1899 epoch, and in Riyadh that is 23:59:08 the day
-- before (lib/importers/exams.ts `toIsoDate`, fixed in the same commit).
--
-- Checked read-only against the client's own files before writing this: of the
-- imported rows that could be matched by name and score/level, every one sat
-- exactly one day before the date in the file (207 exams, 121 plans).
--
-- Only rows the import wrote are moved:
--   · exams  — the single import batch of 9 Sep 2026 (394 rows, created in the
--              same minute); exams entered on screen are never touched;
--   · plans  — issued_by «استيراد» whose issued_at is still the bare midnight
--              the importer wrote (a plan re-issued since carries a real time).
-- Runs once, as every migration does.

UPDATE "exams"
SET "taken_on" = to_char("taken_on"::date + 1, 'YYYY-MM-DD')
WHERE "created_at" >= '2026-09-09 13:15:00'
  AND "created_at" <  '2026-09-09 13:16:00'
  AND "taken_on" ~ '^\d{4}-\d{2}-\d{2}$';

UPDATE "student_plans"
SET "issued_at" = to_char(left("issued_at", 10)::date + 1, 'YYYY-MM-DD') || 'T00:00:00.000Z'
WHERE "issued_by" = 'استيراد'
  AND "issued_at" LIKE '____-__-__T00:00:00.000Z';
