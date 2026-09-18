import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { resolvePlan, dailyAmountFor } from '@/lib/curriculum';
import { ajzaForLevel, nextLevel } from '@/lib/exams';
import type { CurriculumDay, ExamDayMap, StudentPlan, Track } from '@/lib/types';

/* مستواي وخطتي — طا-٥.
   A talqeen student, or one who has not been handed a sheet yet, gets
   `{ plan: null }` and a 200. The UI shows an intentional empty state; an
   error would be a lie about what happened.

   «أين وصلت» — RESTORED 18 Sep 2026, and it is the same feature that was pulled
   out of this route for the right reason and can now come back for the same one.

   It used to say: «NO today. The system does not record which day a boy actually
   reached, so any figure here would be a guess, and a guess on this screen sends
   a child to the wrong passage on the system's authority.» That was true while
   attendance and recitation lived in Ratel and nothing here recorded either. It
   stopped being true when the teacher's portal shipped: `student_progress` holds
   the مقرّر he must recite TODAY, moved by his own teacher's save, and `day_entries`
   hold every مقرّر that was actually recited and when.

   So this is no longer a guess — it is his teacher's own record read back to him,
   which is exactly what the client asked for: «تحديد المقرّر اللي وصل إليه الطالب،
   وتعليم المقرّرات السابقة بعلامة صح في حال سجّلها المعلم» (18 Sep 2026).

   Two guards keep it honest rather than optimistic:
     · `at` is null when nobody has set his pointer, and the screen then behaves
       exactly as it did before — the sheet whole, no «today», no tick.
     · the ticks are matched on LEVEL AND TRACK as well as on the number. A boy
       repeating a level starts its مقرّرات again, and last term's ticks must not
       follow him onto this term's sheet. */
export async function GET() {
  const g = await scope();
  if (!g.ok) return g.res;

  const student = await db.student.findUnique({ where: { id: g.s.sub } });
  if (!student) return NextResponse.json({ error: 'لم يُعثر على الطالب.' }, { status: 404 });

  const track = student.track as Track | null;
  if (!track || track === 'TALQEEN') return NextResponse.json({ plan: null, reason: 'TALQEEN' });

  const row = await db.studentPlan.findFirst({
    where: { studentId: student.id }, orderBy: { issuedAt: 'desc' } });
  if (!row) return NextResponse.json({ plan: null, reason: 'NO_PLAN' });

  /* Only this track and level — never the whole curriculum table. */
  const curriculum = await db.curriculumDay.findMany({
    where: { track: row.track, level: row.level } });

  const plan: StudentPlan = {
    id: row.id, studentId: row.studentId, track: row.track as Track, level: row.level,
    issuedAt: row.issuedAt, issuedBy: row.issuedBy, dayCount: row.dayCount,
    examDays: row.examDays as unknown as ExamDayMap, dailyAmount: row.dailyAmount,
    printedCount: row.printedCount, createdAt: row.createdAt.toISOString(),
  };

  const days = resolvePlan(plan, curriculum as unknown as CurriculumDay[]);
  const next = nextLevel(row.level);

  /* أين وقف، وما سمّعه — both from the teacher's own saves, never inferred from
     the calendar. A day with no DARS recited did not move him and does not get a
     tick: «الانتقال إلى المقرّر التالي» is the درس, and that is what `advances`
     says on the teacher's side too. */
  const [progress, entries] = await Promise.all([
    db.studentProgress.findUnique({ where: { studentId: student.id } }),
    db.dayEntry.findMany({
      where: {
        studentId: student.id,
        level: row.level,
        track: row.track,
        assignmentNo: { not: null },
        lines: { some: { kind: 'DARS', recited: true } },
      },
      select: { day: true, assignmentNo: true, incomplete: true },
      orderBy: { day: 'asc' },
    }),
  ]);

  /* One entry per مقرّر, the LAST time it was recited — a boy who repeated a day
     after a correction has one tick on it, not two. */
  const done = new Map<number, { dayNo: number; on: string; incomplete: boolean }>();
  for (const e of entries) {
    if (e.assignmentNo == null) continue;
    done.set(e.assignmentNo, {
      dayNo: e.assignmentNo, on: e.day, incomplete: e.incomplete });
  }

  return NextResponse.json({
    plan: {
      id: plan.id, track: plan.track, trackAr: track === 'GOLDEN' ? 'ذهبي' : 'فضي',
      level: plan.level, ajza: ajzaForLevel(track, plan.level),
      issuedAt: plan.issuedAt, dayCount: plan.dayCount, examDays: plan.examDays,
      dailyAmount: plan.dailyAmount || dailyAmountFor(track),
    },
    days,
    /** ما عليه اليوم — null until his teacher's supervisor sets his pointer. */
    at: progress?.assignmentNo ?? null,
    /** Stopped at a badge مقرّر: «لا يمضي في الحفظ قبل اختباره». */
    awaitingExam: progress?.awaitingExam ?? null,
    /** المقرّرات التي سجّلها معلمه — بترتيبها وتواريخها. */
    done: [...done.values()].sort((a, b) => a.dayNo - b.dayNo),
    nextLevel: next,
    nextAjza: ajzaForLevel(track, next),
  });
}
