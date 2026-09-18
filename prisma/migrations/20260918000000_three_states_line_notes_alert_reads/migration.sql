-- ثلاث حالات لا أربع، وملاحظة لكل مقرّر، وقراءةٌ لكل تنبيه.
--
-- Three changes the client asked for on 18 Sep 2026, after seeing the portal
-- running. Two of them change what the database can hold, so they are here and
-- not only on a screen.
--
-- 1. «غائب بعذر» IS GONE — «احذفها من الموقع كامل».
--    مع-٣-ب asks for four attendance states and this removes one of them, so
--    the departure is deliberate and recorded rather than quiet. It takes a rule
--    with it: §١٥ said «والغياب بعذر لا يُحتسب فيه، ولا يقطع التتابع», and with
--    no excused absence left, repeat absence simply counts every absence there
--    is. Dropping it from the ENUM and not just from the buttons is the point —
--    a state no report knows how to count must not be writable.
--
-- 2. `recitation_lines.note` — a note on the مقرّر, beside the passage it is
--    about. `day_entries.note` stays: §٩'s «وخانة ملاحظة قصيرة اختيارية» is a
--    note on the AFTERNOON, and «تعثّر في الآيات الأخيرة» is a note on a line.
--    They are two different remarks and a teacher writes both.
--
-- 3. `admin_message_reads` → `teacher_alert_reads`.
--    «والتنبيه غير المقروء فيه دائرة خضراء صغيرة.» A teacher's alerts are six
--    kinds and only ONE of them is a stored message — the other five are
--    computed from rows (a stopped مقرّر, a booking, a result, a delivered plan,
--    a run of absences). A table keyed by message id could only ever mark that
--    one, and the other five would have shown as unread forever. Keyed by the
--    alert's own string instead: `EXAM_DUE:<studentId>`, `RESULT:<examId>`,
--    `MESSAGE:<id>`. The old table held nothing, so nothing is migrated out of
--    it.

-- AlterEnum
BEGIN;
CREATE TYPE "AttendanceStatus_new" AS ENUM ('PRESENT', 'LATE', 'ABSENT');
ALTER TABLE "day_entries" ALTER COLUMN "status" TYPE "AttendanceStatus_new" USING ("status"::text::"AttendanceStatus_new");
ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";
ALTER TYPE "AttendanceStatus_new" RENAME TO "AttendanceStatus";
DROP TYPE "public"."AttendanceStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "admin_message_reads" DROP CONSTRAINT "admin_message_reads_message_id_fkey";

-- AlterTable
ALTER TABLE "recitation_lines" ADD COLUMN     "note" TEXT NOT NULL DEFAULT '';

-- DropTable
DROP TABLE "admin_message_reads";

-- CreateTable
CREATE TABLE "teacher_alert_reads" (
    "teacher_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_alert_reads_pkey" PRIMARY KEY ("teacher_id","key")
);

-- CreateIndex
CREATE INDEX "teacher_alert_reads_teacher_id_read_at_idx" ON "teacher_alert_reads"("teacher_id", "read_at");

