import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { earnsPoints, EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { TXN_KIND_AR, type Track, type TxnKind } from '@/lib/types';
import { isoDate } from '@/lib/dates';
import { badgeAr } from '@/lib/day';
import { shortName } from '@/lib/normalise';

/* ما يجري في الحلقة — the two rails at the bottom of الرئيسية.

   «تحتها قسم آخر الاختبارات … تعرض آخر اختبارات الطلاب بنفس طريقة الطالب … ثم
   تحتها آخر حركات نقاط الطلاب» (client, 18 Sep 2026).

   Its own route rather than folded into `/api/teacher/me` so each section can
   carry its own skeleton — the student's home fetches its exams and its ledger
   the same way, and the shape of the screen should not wait on the slowest
   query in it. */

const EXAMS = 10;
const MOVES = 8;

export async function GET(req: Request) {
  const g = await scope(req);
  if (!g.ok) return g.res;

  const students = await db.student.findMany({
    where: { halaqaId: g.who.halaqaId, status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, track: true, progress: true },
  });
  const ids = students.map((s) => s.id);
  const nameOf = new Map(students.map((s) => [s.id, s.fullName]));
  if (!ids.length) return NextResponse.json({ exams: [], moves: [], due: [] });

  /* ── من يستحق اختبارًا ──────────────────────────────────────────────────
     «آخر اختبارات طلابي تعرض كل من يستحق اختبارًا» (client, 18 Sep 2026).

     The alert list already said it one boy at a time and scrolled away; this is
     the standing list, beside the results, because the two answer one question
     between them: who has been examined, and who is waiting to be. The waiting
     is the half the teacher can act on — he is the one who tells the supervisor.

     A booked sitting stays ON the list rather than leaving it: the appointment
     is not the exam, and a boy whose date was set three weeks ago and never sat
     is exactly the one who disappears otherwise. It is marked instead. */
  const today = isoDate(new Date());
  const open = await db.examBooking.findMany({
    where: { studentId: { in: ids }, status: 'BOOKED' },
    orderBy: { scheduledOn: 'asc' },
    select: { studentId: true, scheduledOn: true },
  });
  const bookedOn = new Map<string, string>();
  for (const b of open) if (!bookedOn.has(b.studentId)) bookedOn.set(b.studentId, b.scheduledOn);

  const due = students
    .filter((s) => s.progress?.awaitingExam)
    .map((s) => ({
      id: s.id,
      fullName: shortName(s.fullName),
      badge: s.progress!.awaitingExam,
      badgeAr: badgeAr(s.progress!.awaitingExam),
      level: s.progress!.level,
      assignmentNo: s.progress!.assignmentNo,
      /** منذ متى وهو ينتظر — اليوم الذي وقف فيه مؤشّره على مقرّر الاختبار. */
      since: isoDate(s.progress!.updatedAt),
      bookedOn: bookedOn.get(s.id) ?? null,
      /** «يحتاج مراجعة» — ما رفعه المعلّم عنه، فيراه هنا أيضًا. */
      needsReview: !!s.progress!.examHoldAt,
    }));

  /* طلاب التلقين خارج نظام النقاط، فلا حركة لهم تُعرض — §١٣، على الخادم. */
  const earning = students
    .filter((s) => earnsPoints({ track: s.track as Track | null }))
    .map((s) => s.id);

  const [exams, moves] = await Promise.all([
    db.exam.findMany({
      where: { studentId: { in: ids } },
      orderBy: [{ takenOn: 'desc' }, { createdAt: 'desc' }],
      take: EXAMS,
    }),
    earning.length
      ? db.pointTxn.findMany({
          where: { studentId: { in: earning } },
          orderBy: { createdAt: 'desc' },
          take: MOVES,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    due,
    today,
    /** Shaped like the student's own `/api/student/exams`, because the rail that
        draws it is the same one — a score is a proportion and is drawn as one. */
    exams: exams.map((e) => ({
      id: e.id,
      studentId: e.studentId,
      studentName: shortName(nameOf.get(e.studentId) ?? ''),
      type: e.type,
      typeAr: EXAM_TYPE_AR[e.type as ExamType] ?? e.type,
      takenOn: e.takenOn,
      level: e.level,
      score: e.score,
      scoreMax: 100,
      passed: e.passed,
    })),
    moves: moves.map((t) => ({
      id: t.id,
      studentId: t.studentId,
      studentName: shortName(nameOf.get(t.studentId) ?? ''),
      delta: t.delta,
      kind: t.kind,
      kindAr: TXN_KIND_AR[t.kind as TxnKind] ?? t.kind,
      reason: t.reason,
      on: t.effectiveOn ?? isoDate(t.createdAt),
    })),
  });
}
