import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { dayCountFor, DEFAULT_EXAM_DAYS } from '@/lib/curriculum';
import { badgeAt } from '@/lib/teacher';
import { badgeAr } from '@/lib/day';
import type { CurriculumDay, ExamDayMap, Track } from '@/lib/types';

/* طلبات تعديل المقرّر — عند المشرف، حيث يُقضى فيها.
 *
 * المعلّم يطلب من بطاقة الطالب (`/api/teacher/students/[id]/assignment`)،
 * والمؤشّر لا يتحرّك بطلبه. هنا يُقرأ الطلب ويُقبل أو يُرفض، والقبول وحده هو
 * الذي يكتب في `student_progress` — بيد المشرف كما كان، وباسمه في السجلّ.
 *
 * والقبول يمرّ بنفس تحقّق `/api/admin/progress`: المنهج قد يُختصر أو يُمدَّد بين
 * الطلب والقضاء فيه، فرقمٌ كان صحيحًا يوم طُلب قد لا يكون صحيحًا اليوم.
 */

const guard = async () => readSession();

export async function GET() {
  const s = await guard();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const rows = await db.assignmentRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: { student: { select: { id: true, fullName: true, halaqaId: true, status: true } } },
  });

  /* طلبٌ على طالب انقطع لا يُعرض: «المنقطع لا يظهر في كشوف الحلقة». */
  const live = rows.filter((r) => r.student.status === 'ACTIVE');

  return NextResponse.json({
    count: live.length,
    requests: live.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: r.student.fullName,
      halaqaId: r.student.halaqaId,
      level: r.level,
      from: r.fromAssignmentNo,
      to: r.toAssignmentNo,
      badge: r.toBadge,
      badgeAr: badgeAr(r.toBadge),
      note: r.note,
      askedByName: r.askedByName,
      at: r.createdAt.toISOString(),
    })),
  });
}

/** اقبل فيتحرّك المؤشّر، أو ارفض فيبقى كما هو ويُقال للمعلّم لماذا. */
export async function POST(req: Request) {
  const s = await guard();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.requestId ?? '');
  const approve = body.approve === true;
  const note = String(body.note ?? '').trim().slice(0, 200);

  const r = await db.assignmentRequest.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: 'لم يُعثر على الطلب.' }, { status: 404 });
  if (r.status !== 'PENDING') {
    return NextResponse.json({ error: 'قُضي في هذا الطلب من قبل.' }, { status: 409 });
  }

  const decided = {
    decidedById: s.sub, decidedByName: s.name, decidedAt: new Date(), decisionNote: note,
  };

  if (!approve) {
    await db.assignmentRequest.update({
      where: { id }, data: { status: 'REJECTED', ...decided },
    });
    await db.auditLog.create({ data: {
      actorId: s.sub, action: 'REJECT_ASSIGNMENT_REQUEST', entity: 'assignment_requests',
      entityId: id, after: { note } as object,
    } });
    return NextResponse.json({ ok: true, status: 'REJECTED' });
  }

  /* القبول كتابةٌ في المؤشّر، فيمرّ بما يمرّ به التحديد اليدويّ: الخطة الأحدث
     هي المرجع، وعدد أيامها هو الحدّ. */
  const student = await db.student.findUnique({
    where: { id: r.studentId },
    include: { plans: { orderBy: { issuedAt: 'desc' }, take: 1 } },
  });
  const plan = student?.plans[0] ?? null;
  if (!student || !plan) {
    return NextResponse.json(
      { error: 'لم تُصدر خطته بعد — أصدر خطة مستواه أولًا.' }, { status: 422 });
  }

  const curriculum = await db.curriculumDay.findMany({
    where: { track: plan.track, level: plan.level } });
  const dayCount = dayCountFor(plan.track as Track, plan.level,
    curriculum as unknown as CurriculumDay[]);
  if (r.toAssignmentNo < 1 || r.toAssignmentNo > Math.max(dayCount, 1)) {
    return NextResponse.json(
      { error: `المقرّر المطلوب خارج خطته الآن — رقم بين ١ و${dayCount || 24}.` },
      { status: 422 });
  }

  const examDays = (plan.examDays as unknown as ExamDayMap | null) ?? DEFAULT_EXAM_DAYS;
  const awaitingExam = badgeAt(r.toAssignmentNo, examDays);
  const before = await db.studentProgress.findUnique({ where: { studentId: r.studentId } });

  await db.$transaction([
    db.studentProgress.upsert({
      where: { studentId: r.studentId },
      create: {
        studentId: r.studentId, track: plan.track, level: plan.level,
        assignmentNo: r.toAssignmentNo, awaitingExam,
        setById: s.sub, setByRole: 'SUPERVISOR', setByName: s.name,
      },
      update: {
        track: plan.track, level: plan.level,
        assignmentNo: r.toAssignmentNo, awaitingExam,
        setById: s.sub, setByRole: 'SUPERVISOR', setByName: s.name,
      },
    }),
    db.assignmentRequest.update({
      where: { id }, data: { status: 'APPROVED', ...decided },
    }),
  ]);

  await db.auditLog.create({ data: {
    actorId: s.sub, action: 'APPROVE_ASSIGNMENT_REQUEST', entity: 'student_progress',
    entityId: r.studentId,
    before: { assignmentNo: before?.assignmentNo ?? null } as object,
    after: { assignmentNo: r.toAssignmentNo, awaitingExam, requestId: id } as object,
  } });

  return NextResponse.json({ ok: true, status: 'APPROVED', assignmentNo: r.toAssignmentNo });
}
