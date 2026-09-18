import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { dayCountFor, DEFAULT_EXAM_DAYS } from '@/lib/curriculum';
import { badgeAt } from '@/lib/teacher';
import { badgeAr } from '@/lib/day';
import type { CurriculumDay, ExamDayMap, Track } from '@/lib/types';
import { TRACK_AR } from '@/lib/types';

/* مؤشّر المقرّر — عند المشرف وحده.
   «المعلم لا يمكن أن يحدد مقرر الطالب، فيظهر له أن الطالب لم يسجل له مقرر عليه
   التوجه إلى مشرف الحلقة» (client, 18 Sep 2026).

   Which makes this route load-bearing rather than a convenience: without it
   «راجع المشرف» is a door nobody can open, and not one of the hundred and
   seventeen students already halfway through a level could ever start.

   The supervisor is the only one who may write here. A teacher's token does not
   reach `/api/admin/*` at all — the middleware refuses it on its audience. */

const guard = async () => readSession();

export async function GET(req: Request) {
  const s = await guard();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const halaqaId = new URL(req.url).searchParams.get('halaqa');

  const [students, halaqat] = await Promise.all([
    db.student.findMany({
      where: { status: 'ACTIVE', ...(halaqaId ? { halaqaId } : {}) },
      orderBy: [{ halaqaId: 'asc' }, { fullName: 'asc' }],
      include: { progress: true, plans: { orderBy: { issuedAt: 'desc' }, take: 1 } },
    }),
    db.halaqa.findMany({ orderBy: { name: 'asc' },
      select: { id: true, name: true, teacher: true } }),
  ]);

  /* Only the levels these students are actually on — never the whole table. */
  const wanted = [...new Set(students
    .map((st) => st.plans[0])
    .filter(Boolean)
    .map((p) => `${p!.track}:${p!.level}`))];
  const curriculum = wanted.length
    ? await db.curriculumDay.findMany({
        where: { OR: wanted.map((w) => {
          const [track, level] = w.split(':');
          return { track, level: Number(level) };
        }) },
      })
    : [];

  return NextResponse.json({
    halaqat,
    students: students.map((st) => {
      const plan = st.plans[0] ?? null;
      const track = (st.track as Track | null) ?? null;
      const dayCount = plan
        ? dayCountFor(plan.track as Track, plan.level,
            curriculum as unknown as CurriculumDay[])
        : 0;
      return {
        id: st.id,
        fullName: st.fullName,
        halaqaId: st.halaqaId,
        trackAr: track ? TRACK_AR[track] : null,
        /* تلقين has no plan and no مقرّر at all — «حضور فقط: لا مقرّر ولا سطر
           ولا نقاط ولا خطة». The screen says so rather than offering a field
           that would be refused. */
        eligible: !!track && track !== 'TALQEEN' && !!plan,
        level: st.progress?.level ?? plan?.level ?? st.currentLevel ?? null,
        assignmentNo: st.progress?.assignmentNo ?? null,
        assignmentOf: dayCount,
        awaitingExam: st.progress?.awaitingExam ?? null,
        awaitingExamAr: badgeAr(st.progress?.awaitingExam ?? null),
        setByName: st.progress?.setByName ?? '',
        updatedAt: st.progress?.updatedAt?.toISOString() ?? null,
      };
    }),
  });
}

/** Set — or clear — where a student stands in his sheet. */
export async function POST(req: Request) {
  const s = await guard();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = String(body.studentId ?? '');
  const raw = body.assignmentNo;

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: { plans: { orderBy: { issuedAt: 'desc' }, take: 1 } },
  });
  if (!student) return NextResponse.json({ error: 'لم يُعثر على الطالب.' }, { status: 404 });

  const plan = student.plans[0] ?? null;
  if (!plan) {
    return NextResponse.json(
      { error: 'لم تُصدر خطته بعد — أصدر خطة مستواه أولًا.' }, { status: 422 });
  }

  const curriculum = await db.curriculumDay.findMany({
    where: { track: plan.track, level: plan.level } });
  const dayCount = dayCountFor(plan.track as Track, plan.level,
    curriculum as unknown as CurriculumDay[]);
  const examDays = (plan.examDays as unknown as ExamDayMap | null) ?? DEFAULT_EXAM_DAYS;

  /* Null clears it — a supervisor who set the wrong boy needs a way back that
     is not «pick a number and hope». The card then reads «لم يُسجَّل له مقرّر»
     again, which is the honest state. */
  if (raw == null || raw === '') {
    await db.studentProgress.upsert({
      where: { studentId },
      create: {
        studentId, track: plan.track, level: plan.level,
        assignmentNo: null, awaitingExam: null,
        setById: s.sub, setByRole: 'SUPERVISOR', setByName: s.name,
      },
      update: {
        assignmentNo: null, awaitingExam: null,
        setById: s.sub, setByRole: 'SUPERVISOR', setByName: s.name,
      },
    });
    await db.auditLog.create({ data: {
      actorId: s.sub, action: 'CLEAR_ASSIGNMENT', entity: 'student_progress',
      entityId: studentId } });
    return NextResponse.json({ ok: true, assignmentNo: null, awaitingExam: null });
  }

  const at = Math.trunc(Number(raw));
  if (!Number.isFinite(at) || at < 1 || at > Math.max(dayCount, 1)) {
    return NextResponse.json(
      { error: `المقرّر رقم بين 1 و${dayCount || 24}.` }, { status: 422 });
  }

  /* Landing ON a badge مقرّر means he is waiting for that exam — the same state
     the pointer reaches by itself when a boy recites his way there, so the
     supervisor setting it by hand produces the same card and the same notice. */
  const awaitingExam = badgeAt(at, examDays);

  const before = await db.studentProgress.findUnique({ where: { studentId } });
  await db.studentProgress.upsert({
    where: { studentId },
    create: {
      studentId, track: plan.track, level: plan.level,
      assignmentNo: at, awaitingExam,
      setById: s.sub, setByRole: 'SUPERVISOR', setByName: s.name,
    },
    update: {
      track: plan.track, level: plan.level,
      assignmentNo: at, awaitingExam,
      setById: s.sub, setByRole: 'SUPERVISOR', setByName: s.name,
    },
  });

  /* Points are money to a child and a مقرّر is his place in the year — both are
     worth a line in the log saying who moved it. */
  await db.auditLog.create({ data: {
    actorId: s.sub, action: 'SET_ASSIGNMENT', entity: 'student_progress',
    entityId: studentId,
    before: { assignmentNo: before?.assignmentNo ?? null } as object,
    after: { assignmentNo: at, awaitingExam } as object,
  } });

  return NextResponse.json({ ok: true, assignmentNo: at, awaitingExam, dayCount });
}
