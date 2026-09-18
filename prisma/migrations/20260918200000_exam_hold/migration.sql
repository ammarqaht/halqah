-- «الطالب ليس مستعدًّا للاختبار ويحتاج مراجعة» — 18 Sep 2026.
--
-- «عند المعلم في صفحة الاختبارات أبي يظهر زر أن الطالب مب جاهز للاختبار ويحتاج
--  مراجعة، ويظهر عند المشرف والطالب ذلك» (client).
--
-- The pointer already knew when a boy had REACHED his exam مقرّر. It never knew
-- whether he was ready to sit it — and the only person who does hears him five
-- afternoons a week. This is that opinion, signed and dated: an opinion nobody
-- signs is one nobody lifts.
--
-- It gates nothing. The booking screen still books, the exam screen still
-- records; both simply say what his teacher thinks first.

-- AlterTable
ALTER TABLE "student_progress" ADD COLUMN     "exam_hold_at" TIMESTAMP(3),
ADD COLUMN     "exam_hold_by" TEXT,
ADD COLUMN     "exam_hold_note" TEXT NOT NULL DEFAULT '';
