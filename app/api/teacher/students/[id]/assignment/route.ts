import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dayCountFor, DEFAULT_EXAM_DAYS } from '@/lib/curriculum';
import { badgeAt } from '@/lib/teacher';
import type { CurriculumDay, ExamDayMap, Track } from '@/lib/types';
import { assertMine, fail, scope } from '../../../_scope';

/* طلب تعديل مقرّر — يقوله المعلّم، ويقضي فيه المشرف.
 *
 * «المعلم لا يمكن أن يحدد مقرر الطالب … عليه التوجه إلى مشرف الحلقة» (العميل،
 * ١٨ سبتمبر ٢٠٢٦). والقاعدة باقية حرفًا حرفًا: لا شيء هنا يكتب في
 * `student_progress`. ما يكتبه هذا المسار صفٌّ في جدول الطلبات، لا أكثر —
 * والمؤشّر لا يتحرّك إلا بقبول المشرف، من مساره هو.
 *
 * وما تغيّر أن «التوجه إلى المشرف» كان مكالمةً أو ورقةً في جيب. صار طلبًا
 * مكتوبًا باسم صاحبه وتاريخه، يظهر عند المشرف في صفحته الأولى.
 */

const MAX_NOTE = 200;

/** طلبه المعلّق على هذا الطالب — تقرؤه البطاقة لتقول «طلبك قيد المراجعة». */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  if (!(await assertMine(g.who.halaqaId, id))) return fail('هذا الطالب ليس في حلقتك.', 403);

  const pending = await db.assignmentRequest.findFirst({
    where: { studentId: id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ pending: pending ? shape(pending) : null });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;

  const { id } = await ctx.params;
  if (!(await assertMine(who.halaqaId, id))) return fail('هذا الطالب ليس في حلقتك.', 403);

  const body = await req.json().catch(() => ({}));
  const note = String(body?.note ?? '').trim().slice(0, MAX_NOTE);

  const student = await db.student.findUnique({
    where: { id },
    include: { progress: true, plans: { orderBy: { issuedAt: 'desc' }, take: 1 } },
  });
  if (!student) return fail('لم يُعثر على الطالب.', 404);

  /* التلقين لا مقرّر له أصلًا — «لا مستوى له ولا منهج» — ومن لم تُصدر خطته
     ليس له عددُ أيام يُقاس عليه الطلب. */
  const plan = student.plans[0] ?? null;
  if (student.track === 'TALQEEN' || !plan) {
    return fail('هذا الطالب بلا خطة — راجع المشرف لإصدارها أولًا.', 422);
  }

  const curriculum = await db.curriculumDay.findMany({
    where: { track: plan.track, level: plan.level },
  });
  const dayCount = dayCountFor(plan.track as Track, plan.level,
    curriculum as unknown as CurriculumDay[]);
  const examDays = (plan.examDays as unknown as ExamDayMap | null) ?? DEFAULT_EXAM_DAYS;

  const to = Math.trunc(Number(body?.toAssignmentNo));
  if (!Number.isFinite(to) || to < 1 || to > Math.max(dayCount, 1)) {
    return fail(`المقرّر رقم بين ١ و${dayCount || 24}.`, 422);
  }

  const from = student.progress?.assignmentNo ?? null;
  if (from === to) return fail('هذا مقرّره الآن — لا شيء يُطلب.', 422);

  /* طلبٌ واحد معلّق لكل طالب. والثاني يستبدل الأول ولا يصطفّ خلفه: المعلّم
     الذي أعاد النظر يريد تصحيح طلبه، والمشرف الذي يفتح الصفحة يجب أن يجد
     رأيًا واحدًا لا رأيين متناقضين على اسم واحد. */
  await db.assignmentRequest.updateMany({
    where: { studentId: id, status: 'PENDING' },
    data: {
      status: 'CANCELLED', decidedAt: new Date(),
      decidedByName: who.name, decisionNote: 'استبدله المعلّم بطلب أحدث',
    },
  });

  const row = await db.assignmentRequest.create({
    data: {
      studentId: id,
      halaqaId: student.halaqaId,
      askedById: who.id,
      askedByRole: who.role,
      askedByName: who.name,
      track: plan.track,
      level: student.progress?.level ?? plan.level,
      fromAssignmentNo: from,
      toAssignmentNo: to,
      /* ١٢ و٢٤ مقرّرا وسام، فالطلب يقول وسامًا أيضًا بلا خانة ثانية يملؤها. */
      toBadge: badgeAt(to, examDays),
      note,
    },
  });

  return NextResponse.json({ ok: true, pending: shape(row) });
}

/** سحب الطلب — لمن طلب ثم بان له غير ذلك قبل أن يقضي المشرف فيه. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  if (!(await assertMine(g.who.halaqaId, id))) return fail('هذا الطالب ليس في حلقتك.', 403);

  await db.assignmentRequest.updateMany({
    where: { studentId: id, status: 'PENDING' },
    data: {
      status: 'CANCELLED', decidedAt: new Date(),
      decidedByName: g.who.name, decisionNote: 'سحبه المعلّم',
    },
  });
  return NextResponse.json({ ok: true, pending: null });
}

type Row = {
  id: string; fromAssignmentNo: number | null; toAssignmentNo: number;
  toBadge: string | null; note: string; askedByName: string;
  level: number | null; createdAt: Date;
};
const shape = (r: Row) => ({
  id: r.id,
  from: r.fromAssignmentNo,
  to: r.toAssignmentNo,
  badge: r.toBadge,
  note: r.note,
  askedByName: r.askedByName,
  level: r.level,
  at: r.createdAt.toISOString(),
});
