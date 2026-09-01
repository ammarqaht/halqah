/* Runs on container start, before the server accepts traffic.
   Idempotent by design: safe to run on every deploy, does nothing on the ones
   where there is nothing to do. */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

try {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log(`[bootstrap] settings ok (${Object.keys(SETTINGS).length})`);

  /* The first supervisor. Created only when no admin exists, so redeploying
     never resets a password that has since been changed.

     The defaults below let the system come up with nothing to configure. They
     are also public, since this repository is: anyone who reads it knows them.
     That is fine while the database is empty and we are testing, and it stops
     being fine the moment real student records are in it. Setting
     ADMIN_PASSWORD in the environment overrides the default without a code
     change — and the app warns on every page until that happens. */
  const DEFAULT_USERNAME = 'admin';
  const DEFAULT_PASSWORD = '12345';

  const count = await db.adminUser.count();
  if (count === 0) {
    const username = process.env.ADMIN_USERNAME || DEFAULT_USERNAME;
    const password = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
    const fullName = process.env.ADMIN_NAME || 'عمار سالم القحطاني';

    await db.adminUser.create({
      data: { fullName, username, passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`[bootstrap] created first supervisor: ${username}`);
    if (password === DEFAULT_PASSWORD) {
      console.warn('[bootstrap] ⚠ using the default password. Set ADMIN_PASSWORD before real data goes in.');
    }
  } else {
    console.log(`[bootstrap] ${count} admin account(s) already present — untouched`);
  }
} catch (e) {
  console.error('[bootstrap] failed:', e.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}
