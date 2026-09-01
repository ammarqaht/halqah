/* Seeds the decided rules (SPEC.md §3.8 / القرارات المعتمدة).
   Rules live in the database, never hard-coded in application code. */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const SETTINGS = {
  passing_score: 80,
  score_deductions: { error: 2, warning: 0.5, tajweed_error: 1 },
  exam_points: {
    SILVER: { BADGE_GOLDEN: 50,  BADGE_DIAMOND: 100, ASSOCIATION: 200 },
    GOLDEN: { BADGE_GOLDEN: 100, BADGE_DIAMOND: 200, ASSOCIATION: 200 },
  },
  weekly_sheet_points: {
    SILVER: { attendance: 10, thobe: 10, dars: 2.5, ms: 2.5, mk: 5 },
    GOLDEN: { attendance: 20, thobe: 10, dars: 5,   ms: 5,   mk: 10 },
  },
  level_expected_days: 24,
  level_late_after_days: 35,
  ratel_stale_after_days: 14,
  default_exam_questions: 5,
};

for (const [key, value] of Object.entries(SETTINGS)) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
console.log(`  ✓ ${Object.keys(SETTINGS).length} إعدادًا مزروعة`);
await db.$disconnect();
