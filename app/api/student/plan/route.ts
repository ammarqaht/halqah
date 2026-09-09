import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { resolvePlan, dailyAmountFor } from '@/lib/curriculum';
import { ajzaForLevel, nextLevel } from '@/lib/exams';
import { estimateCurrentDay } from '@/lib/studentDay';
import { HALAQA_WEEKDAYS } from '@/content/student';
import type { CurriculumDay, ExamDayMap, StudentPlan, Track } from '@/lib/types';

/* مستواي وخطتي — طا-٥.
   A talqeen student, or one who has not been handed a sheet yet, gets
   `{ plan: null }` and a 200. The UI shows an intentional empty state; an
   error would be a lie about what happened. */
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

  return NextResponse.json({
    plan: {
      id: plan.id, track: plan.track, trackAr: track === 'GOLDEN' ? 'ذهبي' : 'فضي',
      level: plan.level, ajza: ajzaForLevel(track, plan.level),
      issuedAt: plan.issuedAt, dayCount: plan.dayCount, examDays: plan.examDays,
      dailyAmount: plan.dailyAmount || dailyAmountFor(track),
    },
    days,
    currentDayNo: estimateCurrentDay(plan.issuedAt, plan.dayCount, HALAQA_WEEKDAYS),
    nextLevel: next,
    nextAjza: ajzaForLevel(track, next),
  });
}
