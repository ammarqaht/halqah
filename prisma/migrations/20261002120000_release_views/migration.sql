-- ما الجديد — مَن رأى أيّ تحديث، ٢ أكتوبر ٢٠٢٦.
--
-- «من الان اي تحديث تضيفه ابيه يطلع كتنبيه … لازم تطلع مرة لكل مشرف … وحط
-- بحسبانك ممكن المشرف مايشوف التحديثات لفترة … فتتجمع عليه كلها» (العميل).
--
-- التحديثات نفسها في الكود (content/releases.ts) لأنها تُكتب مع الخاصية التي
-- تصفها. هنا فقط: فلانٌ رأى التحديث الفلاني. ما لم يُسجَّل هنا لم يُرَ، فيتجمّع
-- على صاحبه حتى يدخل.

-- CreateTable
CREATE TABLE "release_views" (
    "audience" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_views_pkey" PRIMARY KEY ("audience","user_id","release_id")
);
