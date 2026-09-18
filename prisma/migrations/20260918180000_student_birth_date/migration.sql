-- تاريخ ميلاد الطالب — 18 Sep 2026.
--
-- «في نموذج تسجيل طالب أضف خانة تاريخ الميلاد وتكون ثلاث خانات (اليوم — الشهر —
--  السنة) بالميلادي» (client).
--
-- A DATE and not an age. An age is a fact with a shelf life: a roster that
-- stores one is wrong by a year within a year, and nobody ever goes back to
-- correct a hundred and seventeen of them. Nullable because the client's own
-- files do not carry it for everyone, and a guessed birthday is worse than a
-- blank — it reads exactly like a known one.

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "birth_date" TEXT;
