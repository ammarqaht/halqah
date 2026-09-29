import 'server-only';
import { db } from '@/lib/db';
import { isoDate } from '@/lib/dates';
import {
  planAbsences, AUTO_ABSENT_LOOKBACK_DAYS, AUTO_ABSENT_NAME, AUTO_ABSENT_ROLE,
} from '@/lib/absence';

/* الغياب التلقائي — applying the rule in lib/absence.

   There is no scheduler on this platform, so it runs on the way into the screens
   that show attendance: the supervisor's register and today, the teacher's day
   and home, the boy's own page. Whichever opens first after a day has passed
   writes that day's absences, and everyone after reads them.

   It is idempotent — a card already there is never touched, and the unique
   (student, day) key turns a race between two requests into a skipped duplicate
   — and it is throttled per process, so the cost is one pair of reads every few
   minutes, not one per request. */

const EVERY_MS = 5 * 60_000;
let last = 0;
let running: Promise<void> | null = null;

export async function applyAutoAbsence(): Promise<void> {
  if (running) return running;
  if (Date.now() - last < EVERY_MS) return;
  running = run().catch((e) => {
    /* A failed pass must never take a screen down with it; the next one retries. */
    console.error('[auto-absent]', e);
  }).finally(() => { last = Date.now(); running = null; });
  return running;
}

async function run() {
  const now = new Date();
  const today = isoDate(now);
  const start = new Date(now);
  start.setDate(start.getDate() - AUTO_ABSENT_LOOKBACK_DAYS);
  const from = isoDate(start);

  const entries = await db.dayEntry.findMany({
    where: { day: { gte: from, lt: today } },
    select: { studentId: true, halaqaId: true, day: true, status: true },
  });
  if (!entries.length) return;

  const students = await db.student.findMany({
    where: { status: 'ACTIVE', halaqaId: { not: null } },
    select: { id: true, halaqaId: true, createdAt: true },
  });

  const plan = planAbsences({
    entries, today, from,
    roster: students.map((s) => ({ id: s.id, halaqaId: s.halaqaId, since: isoDate(s.createdAt) })),
  });
  if (!plan.length) return;

  const at = new Date();
  const r = await db.dayEntry.createMany({
    data: plan.map((p) => ({
      studentId: p.studentId, halaqaId: p.halaqaId, day: p.day,
      status: 'ABSENT' as const,
      savedByRole: AUTO_ABSENT_ROLE, savedByName: AUTO_ABSENT_NAME, savedAt: at,
    })),
    skipDuplicates: true,
  });
  console.log(`[auto-absent] ${r.count} absences written across ${new Set(plan.map((p) => p.day)).size} day(s)`);
}
