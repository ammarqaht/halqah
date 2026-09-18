import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { absence, type DayRecord } from '@/lib/teacher';
import { balances, earnsPoints } from '@/lib/points';
import { isLate } from '@/lib/exams';
import { isoDate } from '@/lib/dates';
import { TRACK_AR, type Track } from '@/lib/types';

/* مع-٤-أ — قائمة طلابي.
   «صفّ لكل طالب: الاسم كاملًا، والمسار والمستوى، والمقرّر الحالي، وآخر تسميع،
   ورصيد النقاط. وعمود تنبيه صغير.»

   And no halaqa column: «العمود الذي يتكرر بلا اختلاف لا يستحق مساحة. فلا عمود
   للحلقة في بوابة المعلم أصلًا، لأنها واحدة» — the same rule that merged الحلقات
   into the students screen on the supervisor's side. */

export async function GET(req: Request) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;
  const today = isoDate(new Date());

  const students = await db.student.findMany({
    where: { halaqaId: who.halaqaId, status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
    include: { progress: true },
  });
  const ids = students.map((s) => s.id);
  if (!ids.length) return NextResponse.json({ students: [] });

  const [txns, lastRecited, history, plans, bookings] = await Promise.all([
    db.pointTxn.findMany({ where: { studentId: { in: ids } }, orderBy: { createdAt: 'asc' } }),
    /* «آخر تسميع» — the newest day on which any line was actually recited. A day
       he attended without reciting is not one, which is the whole point of the
       column: it is what tells a teacher who has gone quiet. */
    db.dayEntry.findMany({
      where: { studentId: { in: ids }, lines: { some: { recited: true } } },
      select: { studentId: true, day: true },
      orderBy: { day: 'desc' } }),
    db.dayEntry.findMany({
      where: { studentId: { in: ids },
        day: { gte: isoDate(new Date(Date.now() - 60 * 86_400_000)) } },
      select: { studentId: true, day: true, status: true },
      orderBy: { day: 'desc' } }),
    db.studentPlan.findMany({ where: { studentId: { in: ids } }, orderBy: { issuedAt: 'asc' } }),
    db.examBooking.findMany({
      where: { studentId: { in: ids }, status: 'BOOKED', scheduledOn: { gte: today } },
      orderBy: { scheduledOn: 'asc' } }),
  ]);

  const bal = balances(txns.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })) as never);
  const recitedOn = new Map<string, string>();
  for (const r of lastRecited) if (!recitedOn.has(r.studentId)) recitedOn.set(r.studentId, r.day);
  const planOf = new Map<string, (typeof plans)[number]>();
  for (const p of plans) planOf.set(p.studentId, p);
  const bookingOf = new Map<string, (typeof bookings)[number]>();
  for (const b of bookings) if (!bookingOf.has(b.studentId)) bookingOf.set(b.studentId, b);

  const byStudent = new Map<string, DayRecord[]>();
  for (const h of history) {
    const list = byStudent.get(h.studentId) ?? [];
    list.push({ day: h.day, status: h.status });
    byStudent.set(h.studentId, list);
  }

  return NextResponse.json({
    students: students.map((s) => {
      const track = (s.track as Track | null) ?? null;
      const plan = planOf.get(s.id) ?? null;
      const a = absence(byStudent.get(s.id) ?? [], today);
      const eligible = earnsPoints({ track });
      return {
        id: s.id,
        fullName: s.fullName,
        track,
        trackAr: track ? TRACK_AR[track] : null,
        level: s.progress?.level ?? plan?.level ?? s.currentLevel ?? null,
        assignmentNo: s.progress?.assignmentNo ?? null,
        assignmentOf: plan?.dayCount ?? 0,
        awaitingExam: s.progress?.awaitingExam ?? null,
        lastRecitedOn: recitedOn.get(s.id) ?? null,
        balance: eligible ? (bal.get(s.id)?.balance ?? 0) : null,
        /** The small alert column: «بلغ مقرّر الاختبار · اختباره محجوز · تأخّر
            على مستواه · غياب متكرر». */
        flags: {
          dueForExam: !!s.progress?.awaitingExam,
          /** «يحتاج مراجعة» — رأي المعلّم نفسه، يراه حيث يرى بقية طلابه. */
          needsReview: !!s.progress?.examHoldAt,
          booked: bookingOf.get(s.id)?.scheduledOn ?? null,
          lateOnLevel: isLate(plan),
          absence: a.flagged ? (a.streak >= 3 ? a.streak : a.inWindow) : 0,
          absenceKind: a.flagged ? (a.streak >= 3 ? 'STREAK' : 'WINDOW') : null,
        },
      };
    }),
  });
}
