-- مسار التلقين: أين وقف — 18 Sep 2026.
--
-- «طلاب التلقين ذكرنا أنه يسجّل لهم المعلم آخر سورة قرأوها وآخر آية حفظوها، وفي
--  اليوم التالي يعرض من أين يبدأ» (client).
--
-- A talqeen boy is outside the curriculum by design (§١٣-١: «لا مستوى له ولا
-- منهج»), so there was nowhere at all to write down where he had reached — his
-- card offered attendance and a thobe and nothing else. These two columns are
-- that record, and they sit in the same two places `assignment_no` does: on the
-- DAY, which must keep saying what was read that afternoon, and on the pointer,
-- which is what his card opens on tomorrow.

-- AlterTable
ALTER TABLE "day_entries" ADD COLUMN     "talqeen_ayah" INTEGER,
ADD COLUMN     "talqeen_surah" TEXT;

-- AlterTable
ALTER TABLE "student_progress" ADD COLUMN     "talqeen_ayah" INTEGER,
ADD COLUMN     "talqeen_surah" TEXT;

