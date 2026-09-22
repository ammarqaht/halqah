-- طلب تعديل مقرّر — من المعلّم إلى المشرف، ٢٢ سبتمبر ٢٠٢٦.
--
-- «المعلم لا يمكن أن يحدد مقرر الطالب … عليه التوجه إلى مشرف الحلقة» (العميل،
-- ١٨ سبتمبر ٢٠٢٦). القاعدة باقية: لا يكتب المعلّم في `student_progress` حرفًا.
-- لكن «التوجه إلى المشرف» كان مكالمةً أو ورقةً في جيب — يضيع الطلب أو يُنسى.
--
-- فصار الطلب مكتوبًا: يقوله المعلّم من بطاقة الطالب، ويظهر عند المشرف في صفحته
-- الأولى، ويُقبل أو يُرفض بضغطة. والقبول وحده يحرّك المؤشّر، وبيد المشرف.
--
-- وفيه لقطةُ موضعه ساعةَ الطلب: المؤشّر يتحرّك بالتسميع كل عصر، وطلبٌ يُقرأ بعد
-- يومين لا يُفهم إن لم يقل من أين أراد نقله.

-- CreateTable
CREATE TABLE "assignment_requests" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "halaqa_id" TEXT,
    "asked_by_id" TEXT,
    "asked_by_role" TEXT NOT NULL DEFAULT 'TEACHER',
    "asked_by_name" TEXT NOT NULL DEFAULT '',
    "track" TEXT,
    "level" INTEGER,
    "from_assignment_no" INTEGER,
    "to_assignment_no" INTEGER NOT NULL,
    "to_badge" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decided_by_id" TEXT,
    "decided_by_name" TEXT NOT NULL DEFAULT '',
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assignment_requests_status_created_at_idx" ON "assignment_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "assignment_requests_student_id_status_idx" ON "assignment_requests"("student_id", "status");

-- CreateIndex
CREATE INDEX "assignment_requests_halaqa_id_status_idx" ON "assignment_requests"("halaqa_id", "status");

-- AddForeignKey
ALTER TABLE "assignment_requests" ADD CONSTRAINT "assignment_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
