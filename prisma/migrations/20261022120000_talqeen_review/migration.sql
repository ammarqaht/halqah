-- مراجعة التلقين — ٢٢ أكتوبر ٢٠٢٦.
--
-- «نبي معلم حلقة التلقين يقدر يسجل مراجعة لطلابه ايضا» (العميل). Two nullable
-- columns on the day: the surah the review started at and the one it ended at.
-- Nothing existing changes; a day without a review keeps both empty.

-- AlterTable
ALTER TABLE "day_entries" ADD COLUMN "talqeen_review_from" TEXT;
ALTER TABLE "day_entries" ADD COLUMN "talqeen_review_to" TEXT;
