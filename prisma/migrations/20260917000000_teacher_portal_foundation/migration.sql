-- بوابة المعلم — الأساس الناقص.
--
-- The third requirements document was held against this schema line by line,
-- and five of the portal's pillars turned out to have no table under them at
-- all: the teacher himself (a NAME in `halaqat.teacher`, with no account), a
-- dated attendance record (only `students.attended_days`, a 0–7 count carried
-- in from رتل), a recitation record (nothing), the pointer saying where a
-- student stopped inside his plan (the system records that a plan was ISSUED,
-- never how far into it he got), and the daily point items (`exam_points` held
-- the badges alone). Not hard to build — simply absent, which is why the whole
-- portal is nine days of screens on top of five of foundation and not nine.
--
-- Two things about the shape are deliberate and worth stating here, where the
-- next person to read a column name will be.
--
-- 1. NONE OF THESE TABLES TRAVELS THROUGH `PUT /api/state`.
--    That endpoint replaces the supervisor's whole working set from whatever
--    his browser holds — it deletes and rewrites exams, plans, points, orders
--    and curriculum. Correct for lists one supervisor owns; catastrophic for a
--    record seven teachers write into from the mosque floor, where one save
--    from his laptop would erase an afternoon of التحضير without anyone
--    touching it. These rows are written only by `/api/teacher/*`, scoped on
--    the server to the halaqa of whoever is asking. It is also why the مقرّر
--    pointer is its own table instead of a column on `student_plans`: that
--    table is deleted and rewritten on every save, so a pointer stored there
--    would silently reset to a stale browser's idea of it.
--
-- 2. THERE IS NO CALENDAR TABLE.
--    «أيّ يوم يكون فيه تحضير يُعتبر يوم حلقة» (the client, 17 Sep 2026), so
--    `day_entries` IS the calendar. Sunday to Thursday open themselves; a
--    Friday on which a halaqa is held is opened by hand and counts the same
--    once it is; a day nobody registered is not a halaqa day. Absence is
--    therefore counted over registered days only — and an Eid holiday cannot
--    produce one false غياب, because there is no such day to be absent from.
--    The requirements document asked for a holidays table (§٨) to solve
--    exactly that problem. This answer solves it with nothing to maintain.

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EXCUSED', 'ABSENT');

-- AlterTable
ALTER TABLE "halaqat" ADD COLUMN     "teacher_id" TEXT;

-- AlterTable
ALTER TABLE "point_txns" ADD COLUMN     "effective_on" TEXT;

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "national_id" TEXT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_entries" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "halaqa_id" TEXT,
    "day" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "thobe" BOOLEAN NOT NULL DEFAULT false,
    "assignment_no" INTEGER,
    "level" INTEGER,
    "track" TEXT,
    "incomplete" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "saved_by_id" TEXT,
    "saved_by_role" TEXT NOT NULL DEFAULT 'TEACHER',
    "saved_by_name" TEXT NOT NULL DEFAULT '',
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recitation_lines" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recited" BOOLEAN NOT NULL DEFAULT false,
    "errors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recitation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_entry_revisions" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "by_id" TEXT,
    "by_role" TEXT NOT NULL DEFAULT 'TEACHER',
    "by_name" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_entry_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_progress" (
    "student_id" TEXT NOT NULL,
    "track" TEXT,
    "level" INTEGER,
    "assignment_no" INTEGER,
    "awaiting_exam" TEXT,
    "set_by_id" TEXT,
    "set_by_role" TEXT NOT NULL DEFAULT 'TEACHER',
    "set_by_name" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_progress_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "admin_messages" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "teacher_id" TEXT,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_message_reads" (
    "message_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_message_reads_pkey" PRIMARY KEY ("message_id","teacher_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teachers_username_key" ON "teachers"("username");

-- CreateIndex
CREATE INDEX "day_entries_halaqa_id_day_idx" ON "day_entries"("halaqa_id", "day");

-- CreateIndex
CREATE INDEX "day_entries_day_idx" ON "day_entries"("day");

-- CreateIndex
CREATE UNIQUE INDEX "day_entries_student_id_day_key" ON "day_entries"("student_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "recitation_lines_entry_id_kind_key" ON "recitation_lines"("entry_id", "kind");

-- CreateIndex
CREATE INDEX "day_entry_revisions_entry_id_at_idx" ON "day_entry_revisions"("entry_id", "at");

-- CreateIndex
CREATE INDEX "admin_messages_teacher_id_created_at_idx" ON "admin_messages"("teacher_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "halaqat_teacher_id_key" ON "halaqat"("teacher_id");

-- CreateIndex
CREATE INDEX "point_txns_effective_on_idx" ON "point_txns"("effective_on");

-- AddForeignKey
ALTER TABLE "halaqat" ADD CONSTRAINT "halaqat_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_entries" ADD CONSTRAINT "day_entries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recitation_lines" ADD CONSTRAINT "recitation_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "day_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_entry_revisions" ADD CONSTRAINT "day_entry_revisions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "day_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_messages" ADD CONSTRAINT "admin_messages_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_message_reads" ADD CONSTRAINT "admin_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "admin_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

