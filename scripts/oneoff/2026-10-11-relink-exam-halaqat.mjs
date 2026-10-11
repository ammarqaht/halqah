/* One-off (11 Oct 2026): the exams imported from Excel on 9 Sep still carry the
   halaqa ids of the roster as it was before the halaqat were re-imported, so
   every report printed «—» for their halaqa. Each old id maps to exactly one
   current halaqa (matched on the boys' current halaqa, by plurality — a clean
   one-to-one). Only `exams.halaqa_id` changes; results, dates and points don't.
   Writes a backup JSON beside itself first (gitignored; `{ map, rows }` —
   each row's original halaqaId — is all a revert needs). Run once:
     node --env-file=.env.local scripts/oneoff/2026-10-11-relink-exam-halaqat.mjs */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';

const db = new PrismaClient();
const halaqat = await db.halaqa.findMany({ select: { id: true, teacher: true } });
const byTeacher = (t) => {
  const hs = halaqat.filter((x) => x.teacher === t);
  if (hs.length !== 1) throw new Error(`${hs.length} halaqat for ${t} — expected exactly one`);
  return hs[0].id;
};
const map = {
  '5q7w90dk': byTeacher('محمد عبده شايع الحميري'),
  '8w9pz3rk': byTeacher('هشام سليم'),
  'kti5b8ir': byTeacher('اسامة محمد محمد القاضي'),
  'jlaz97ry': byTeacher('حسن محمد ماهر علي'),
  'usgmdj5t': byTeacher('الحسيني عبد الوهاب الحسيني السعدني'),
  'ptlrrkin': byTeacher('نبيل صلاح الدين السيد عبدالعزيز محمد'),
  'afaeowxm': byTeacher('صلاح الدين يحيى محمد محمد'),
};

const rows = await db.exam.findMany({
  where: { halaqaId: { in: Object.keys(map) } }, select: { id: true, halaqaId: true } });
for (const [from, to] of Object.entries(map)) {
  console.log(from, '→', to, rows.filter((r) => r.halaqaId === from).length);
}
const backup = new URL('./2026-10-11-exams-halaqa-backup.json', import.meta.url);
writeFileSync(backup, JSON.stringify({ map, rows }, null, 1));
console.log('backed up', rows.length, 'exams →', backup.pathname);

const res = await db.$transaction(Object.entries(map).map(([from, to]) =>
  db.exam.updateMany({ where: { halaqaId: from }, data: { halaqaId: to } })));
console.log('relinked', res.reduce((a, r) => a + r.count, 0));

const [{ n }] = await db.$queryRawUnsafe(
  'select count(*)::int n from exams where halaqa_id is not null and halaqa_id not in (select id from halaqat)');
console.log('orphans left', n);
await db.$disconnect();
