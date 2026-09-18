import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertMine, fail, scope } from '../../../_scope';
import { resolvePlan, dailyAmountFor, TAJWEED_FOOTER } from '@/lib/curriculum';
import { ajzaForLevel } from '@/lib/exams';
import {
  PLAN_KIND_AR, type CurriculumDay, type ExamDayMap, type PlanKind, type StudentPlan,
  type Track,
} from '@/lib/types';

/* مع-٥ — خطة الطالب عند المعلم.
   «عرض الخطة كاملة: أربعة وعشرون مقرّرًا، لكل مقرّر ثلاثة أسطر بالسور والآيات،
   ومقرّرا الاختبار (١٢ و٢٤) ممّيزان. وتمييز مقرّر الطالب الحالي في الجدول، ليعرف
   المعلم أين هو وما بقي عليه.»

   Read-only, and that is the whole contract: «وما لا يملكه — إصدار المستوى
   الجديد … وتعديل الخطة». There is no POST here, and the teacher's screen has no
   button the server would have to refuse.

   `resolvePlan` is the same resolver the supervisor's plan editor and the
   student's own sheet use (SPEC §3.3), so three surfaces cannot show three
   different آيات for one مقرّر. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await scope(req);
  if (!g.ok) return g.res;

  const { id } = await ctx.params;
  if (!(await assertMine(g.who.halaqaId, id))) {
    return fail('هذا الطالب ليس في حلقتك.', 403);
  }

  const student = await db.student.findUniqueOrThrow({
    where: { id }, include: { progress: true } });
  const track = student.track as Track | null;

  /* «مسار التلقين بلا مستوى ولا خطة» — a 200 with a reason, not an error: the
     screen shows an intentional empty state, and a 404 would be a lie about
     what happened. */
  if (!track || track === 'TALQEEN') {
    return NextResponse.json({ plan: null, reason: 'TALQEEN', student: {
      id: student.id, fullName: student.fullName } });
  }

  const row = await db.studentPlan.findFirst({
    where: { studentId: id }, orderBy: { issuedAt: 'desc' } });
  if (!row) {
    return NextResponse.json({ plan: null, reason: 'NO_PLAN', student: {
      id: student.id, fullName: student.fullName } });
  }

  const curriculum = await db.curriculumDay.findMany({
    where: { track: row.track, level: row.level } });

  const plan: StudentPlan = {
    id: row.id, studentId: row.studentId, track: row.track as Track, level: row.level,
    issuedAt: row.issuedAt, issuedBy: row.issuedBy, dayCount: row.dayCount,
    examDays: row.examDays as unknown as ExamDayMap, dailyAmount: row.dailyAmount,
    printedCount: row.printedCount, createdAt: row.createdAt.toISOString(),
  };

  const days = resolvePlan(plan, curriculum as unknown as CurriculumDay[]);

  return NextResponse.json({
    student: {
      id: student.id,
      fullName: student.fullName,
      trackAr: track === 'GOLDEN' ? 'ذهبي' : 'فضي',
      grade: student.grade || null,
      stage: student.stage || null,
    },
    plan: {
      level: plan.level,
      ajza: ajzaForLevel(track, plan.level),
      issuedAt: plan.issuedAt,
      dayCount: plan.dayCount,
      examDays: plan.examDays,
      dailyAmount: plan.dailyAmount || dailyAmountFor(track),
    },
    /** Where he stands on it — the one thing the supervisor's copy of this sheet
        cannot show, because the pointer did not exist until this portal. */
    currentAssignment: student.progress?.assignmentNo ?? null,
    awaitingExam: student.progress?.awaitingExam ?? null,
    kindAr: PLAN_KIND_AR as Record<PlanKind, string>,
    days,
    /** «بترويسته ومرجع التجويد في ذيله، في صفحة واحدة» — printed, not decoration:
        the student reads it while he waits his turn. */
    tajweed: TAJWEED_FOOTER,
  });
}
