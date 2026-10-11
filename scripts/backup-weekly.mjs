/* النسخة الاحتياطية الأسبوعية — «ابيك تاخذ نسخة احتياطية بشكل اسبوعي للنقاط
   والتسميع ومستويات الطلاب واختباراتهم، وتحذف النسخة اللي قبلها» (11 Oct 2026).

   Runs on the owner's Mac, not on the server: launchd starts it every Saturday
   night (scripts/backup/com.medad.halqah.backup.plist — see its header), and a
   Mac that was asleep runs it on waking. READ-ONLY against the database.

   One gzipped JSON per week in ~/Documents/Halqah-Backups. The previous file is
   deleted only AFTER the new one is written and read back whole — a failed run
   leaves last week's copy where it was.

   Every column, under its database name, so a row can be restored as it was.
   The students and halaqat ride along so the file can be read without the
   database: an id with no name is not a backup anyone can use. */
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const DIR = process.env.HALQAH_BACKUP_DIR || join(homedir(), 'Documents', 'Halqah-Backups');
const PREFIX = 'halqah-backup-';
/** Only ever its own files — never anything else that happens to share the folder. */
const OURS = /^halqah-backup-[\d-]+\.json\.gz$/;

const TABLES = {
  /* النقاط */
  point_txns: 'النقاط — كل حركة',
  /* التسميع والحضور */
  day_entries: 'التسجيل اليومي — الحضور والثوب',
  recitation_lines: 'التسميع — الدرس والمراجعتان',
  day_entry_revisions: 'سجل تعديل التسجيل اليومي',
  /* المستويات */
  student_progress: 'موضع كل طالب — المسار والمستوى والمقرّر',
  student_plans: 'سجل المستويات المسلَّمة',
  /* الاختبارات */
  exams: 'الاختبارات',
  exam_questions: 'أسئلة الاختبارات',
  /* لقراءة ما سبق */
  students: 'الطلاب',
  halaqat: 'الحلقات',
};

/** Local time — the Saturday night it is named for, not UTC's. */
const stamp = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`;
};
/** A failure nobody reads in a log is a failure nobody knows about. */
const notify = (msg) => {
  try {
    execFileSync('osascript', ['-e', `display notification ${JSON.stringify(msg)} with title "نسخة حلقة الاحتياطية"`]);
  } catch { /* not on a Mac, or no session — the log still has it */ }
};
const log = (...a) => console.log(new Date().toISOString(), ...a);

const db = new PrismaClient();
try {
  const names = Object.keys(TABLES);
  /* One snapshot, and read-only at the database: a points row written between
     two reads must not appear in one table and not the other, and nothing in
     this transaction is able to write. Table names are the fixed list above. */
  const rows = await db.$transaction([
    db.$executeRawUnsafe('set transaction isolation level repeatable read read only'),
    ...names.map((t) => db.$queryRawUnsafe(`select * from "${t}"`)),
  ]);
  const data = {};
  const counts = {};
  names.forEach((t, i) => { data[t] = rows[i + 1]; counts[t] = data[t].length; });
  /* An empty or wrong database must not cost us last week's good copy. */
  if (!counts.students || !counts.halaqat) throw new Error('no students or halaqat — wrong database?');

  const body = JSON.stringify(
    { takenAt: new Date().toISOString(), tables: TABLES, counts, data },
    (_k, v) => (typeof v === 'bigint' ? Number(v) : v),
  );

  mkdirSync(DIR, { recursive: true });
  const file = join(DIR, `${PREFIX}${stamp()}.json.gz`);
  /* Written under a name it cannot be mistaken by, and given its real one only
     once it reads back whole. */
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, gzipSync(body));

  /* Read it back before trusting it with last week's place. */
  const back = JSON.parse(gunzipSync(readFileSync(tmp)).toString('utf8'));
  for (const [t, n] of Object.entries(counts)) {
    if (back.data[t]?.length !== n) throw new Error(`verify failed on ${t}`);
  }

  renameSync(tmp, file);

  for (const f of readdirSync(DIR)) {
    if (OURS.test(f) && f !== basename(file)) rmSync(join(DIR, f));
  }
  log('ok', file, JSON.stringify(counts));
} catch (e) {
  log('FAILED', e?.message ?? e);
  notify(`فشلت النسخة الأسبوعية — النسخة السابقة باقية. التفاصيل في ${join(DIR, 'backup.log')}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
