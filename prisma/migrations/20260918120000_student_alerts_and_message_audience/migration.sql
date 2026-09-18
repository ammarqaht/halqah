-- تنبيهات الطالب، ورسائل الإدارة إليه — 18 Sep 2026.
--
-- «أضف زرّ الجرس للطالب، وبلوك التنبيهات كذلك … وتعرض للطالب التنبيهات التي
--  تُسجَّل له من قِبل المعلم أثناء تسجيل التسميع، وترسل له تنبيهات الاختبارات
--  وتنبيهات الهدايا والتي تُرسل من قِبل المشرف» (client).
--
-- `audience` is STATED rather than inferred from which id is set, because a
-- broadcast has neither — and «to everyone» must still say to everyone of WHICH
-- kind. Existing rows default to TEACHERS, which is what every one of them is:
-- the column did not exist until students could be addressed.
--
-- `student_alert_reads` mirrors `teacher_alert_reads` for the same reason it
-- exists there: most of a student's alerts are COMPUTED from rows, so they have
-- no id of their own to carry a marker.

-- AlterTable
ALTER TABLE "admin_messages" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'TEACHERS',
ADD COLUMN     "student_id" TEXT;

-- CreateTable
CREATE TABLE "student_alert_reads" (
    "student_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_alert_reads_pkey" PRIMARY KEY ("student_id","key")
);

-- CreateIndex
CREATE INDEX "student_alert_reads_student_id_read_at_idx" ON "student_alert_reads"("student_id", "read_at");

-- CreateIndex
CREATE INDEX "admin_messages_student_id_created_at_idx" ON "admin_messages"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_messages_audience_created_at_idx" ON "admin_messages"("audience", "created_at");

-- AddForeignKey
ALTER TABLE "admin_messages" ADD CONSTRAINT "admin_messages_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_alert_reads" ADD CONSTRAINT "student_alert_reads_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

