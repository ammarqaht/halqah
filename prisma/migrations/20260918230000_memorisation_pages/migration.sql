-- حسبة الأوجه — «مسارات الحفظ» — 18 Sep 2026.
--
-- «حسبة الأوجه أبيك تحطها كما هي موجودة عندك في الصورة، وتكون مربوطة بقاعدة
--  البيانات فقط، ما يحتاج تذكر تفاصيلها للعلن» (client).
--
-- So the rule is a ROW, not a constant: a figure is changed with one UPDATE
-- rather than a deployment, and nothing on any screen prints the bands — only
-- the totals they produce. `lib/pages.ts` holds the shape and reads it back,
-- filling anything missing from the same defaults seeded here.
--
--   الذهبي — ٣٠ مستوى، كل مستوى جزء: درس وجه · صغرى آخر ٣ دروس ·
--            كبرى ١٠ أوجه حتى الجزء ١٠، ثم ١٥ حتى ٢٠، ثم ٢٠
--   الفضي  — ٦٠ مستوى، كل مستوى حزب: درس نصف وجه · صغرى آخر درسين ·
--            كبرى ٥ أوجه حتى الجزء ٥، ثم ١٠ حتى ١٥، ثم ١٥

INSERT INTO "settings" ("key", "value", "updated_at")
VALUES (
  'memorisation_pages',
  '{"GOLDEN":{"lesson":1,"sughraLessons":3,"kubra":[{"upToJuz":10,"pages":10},{"upToJuz":20,"pages":15},{"upToJuz":30,"pages":20}]},"SILVER":{"lesson":0.5,"sughraLessons":2,"kubra":[{"upToJuz":5,"pages":5},{"upToJuz":15,"pages":10},{"upToJuz":30,"pages":15}]}}'::jsonb,
  now()
)
ON CONFLICT ("key") DO NOTHING;
