import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, scope, teacherSettings } from '../_scope';
import { absence, daysInPeriod, type DayRecord } from '@/lib/teacher';
import { knightsOfWeek } from '@/lib/knights';
import { badgeAr } from '@/lib/day';
import {
  balances, earnsPoints, EXAM_TYPE_SHORT_AR, type ExamType,
} from '@/lib/points';
import { daysSince, isLate } from '@/lib/exams';
import { isoDate } from '@/lib/dates';
import { PLAN_KIND_AR, TRACK_AR, type PlanKind, type Track } from '@/lib/types';

/* §١٤ — تقارير المعلم. The four LIST reports of the first release are served
   here; خطة الطالب and تقرير الطالب الشامل are one student each and read from
   `/api/teacher/students/[id]`, and الورقة الأسبوعية is the roster plus empty
   columns, which needs no data beyond the roster itself.

   «كل تقرير في النسخة الأولى يُطبع في ورقة واحدة» — so each one is capped or
   split cleanly, and the cap is stated in the response rather than silently
   truncating a sheet the teacher will hand to a parent. */

export type ReportKind =
  'ROSTER' | 'ABSENCE' | 'INCOMPLETE' | 'DUE' | 'WEEKLY' | 'KNIGHTS';


export async function GET(req: Request) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;

  const url = new URL(req.url);
  const kind = String(url.searchParams.get('kind') ?? 'ROSTER') as ReportKind;
  const today = isoDate(new Date());
  const to = (url.searchParams.get('to') || today).slice(0, 10);
  const from = (url.searchParams.get('from')
    || isoDate(new Date(Date.now() - 29 * 86_400_000))).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return fail('تاريخ غير صحيح.');
  }
  if (from > to) return fail('بداية المدة بعد نهايتها.');

  const [halaqa, { weekdays }] = await Promise.all([
    db.halaqa.findUnique({ where: { id: who.halaqaId } }),
    teacherSettings(who.halaqaId),
  ]);
  if (!halaqa) return fail('لم يُعثر على الحلقة.', 404);

  const students = await db.student.findMany({
    where: { halaqaId: who.halaqaId, status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
    include: { progress: true },
  });
  const ids = students.map((s) => s.id);

  const head = {
    halaqa: { name: halaqa.name, teacher: halaqa.teacher, timeSlot: halaqa.timeSlot },
    from, to, today,
    /** «محسوبًا على أيام الحلقة وحدها لا على أيام التقويم» — the denominator
        every attendance figure in these reports is a share of. */
    halaqaDays: daysInPeriod(from, to, weekdays, today).length,
  };

  if (!ids.length) return NextResponse.json({ kind, ...head, rows: [] });

  /* ── كشف حلقتي — «طلابه ومستوياتهم ومقرّراتهم وآخر تسميع ونقاطهم، ورقة واحدة
     يحملها معه». The one report he carries rather than sends. */
  if (kind === 'ROSTER' || kind === 'WEEKLY') {
    const [txns, lastRecited, plans, exams] = await Promise.all([
      db.pointTxn.findMany({ where: { studentId: { in: ids } } }),
      db.dayEntry.findMany({
        where: { studentId: { in: ids }, lines: { some: { recited: true } } },
        select: { studentId: true, day: true }, orderBy: { day: 'desc' } }),
      db.studentPlan.findMany({ where: { studentId: { in: ids } }, orderBy: { issuedAt: 'asc' } }),
      /* «وآخر اختبار وتاريخه» — newest first, and the first one per student is
         his. Ordered by `takenOn` and then by entry time, so a boy who sat two
         on one afternoon shows the one recorded last rather than either. */
      db.exam.findMany({
        where: { studentId: { in: ids } },
        orderBy: [{ takenOn: 'desc' }, { createdAt: 'desc' }],
        select: { studentId: true, type: true, takenOn: true, passed: true } }),
    ]);
    const bal = balances(txns.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })) as never);
    const recitedOn = new Map<string, string>();
    for (const r of lastRecited) if (!recitedOn.has(r.studentId)) recitedOn.set(r.studentId, r.day);
    const planOf = new Map<string, (typeof plans)[number]>();
    for (const p of plans) planOf.set(p.studentId, p);
    const examOf = new Map<string, (typeof exams)[number]>();
    for (const e of exams) if (!examOf.has(e.studentId)) examOf.set(e.studentId, e);

    return NextResponse.json({
      kind, ...head,
      /** The weekly sheet needs the days its columns are headed with — «الورقة
          الحالية بأعمدتها، للاحتياط عند تعطّل الجوال». */
      days: kind === 'WEEKLY'
        ? daysInPeriod(from, to, weekdays, today).slice(-7) : undefined,
      rows: students.map((s) => {
        const track = s.track as Track | null;
        const plan = planOf.get(s.id) ?? null;
        const exam = examOf.get(s.id) ?? null;
        return {
          id: s.id,
          fullName: s.fullName,
          trackAr: track ? TRACK_AR[track] : '—',
          level: s.progress?.level ?? plan?.level ?? s.currentLevel ?? null,
          assignmentNo: s.progress?.assignmentNo ?? null,
          assignmentOf: plan?.dayCount ?? 0,
          lastRecitedOn: recitedOn.get(s.id) ?? null,
          balance: earnsPoints({ track }) ? (bal.get(s.id)?.balance ?? 0) : null,
          /** «كم مضى على المستوى» — days since his sheet was handed to him, and
              whether that is past §٤.٩'s limit. The two columns the teacher
              carries this sheet to answer: who is stuck, and who is overdue for
              an examiner. */
          daysOnLevel: plan ? daysSince(plan.issuedAt) : null,
          lateOnLevel: isLate(plan),
          lastExamAr: exam ? EXAM_TYPE_SHORT_AR[exam.type as ExamType] ?? exam.type : null,
          lastExamOn: exam?.takenOn ?? null,
          lastExamPassed: exam?.passed ?? null,
        };
      }),
    });
  }

  /* ── كشف الغياب — «حضور طلاب الحلقة خلال مدة يختارها، مع مجموع الغياب لكل
     طالب». Counted over registered days only, so a holiday cannot appear as an
     absence: there is no such day in the record to be absent from. */
  if (kind === 'ABSENCE') {
    const entries = await db.dayEntry.findMany({
      where: { studentId: { in: ids }, day: { gte: from, lte: to } },
      select: { studentId: true, day: true, status: true, thobe: true },
      orderBy: { day: 'desc' },
    });
    const byStudent = new Map<string, DayRecord[]>();
    for (const e of entries) {
      const list = byStudent.get(e.studentId) ?? [];
      list.push({ day: e.day, status: e.status });
      byStudent.set(e.studentId, list);
    }

    return NextResponse.json({
      kind, ...head,
      rows: students.map((s) => {
        const mine = byStudent.get(s.id) ?? [];
        const a = absence(mine, to);
        const count = (st: string) => mine.filter((m) => m.status === st).length;
        return {
          id: s.id,
          fullName: s.fullName,
          registered: mine.length,
          present: count('PRESENT'),
          late: count('LATE'),
          absent: count('ABSENT'),
          /** Unregistered days in the period — «يظهر في كشف حلقتك أنت غير
              مسجَّل، فتعرف أنت ما لا يُطالَب به هو». Not absence; silence. */
          unregistered: Math.max(0, head.halaqaDays - mine.length),
          streak: a.streak,
          flagged: a.flagged,
        };
      }),
    });
  }

  /* ── كشف التسميع الناقص — «مَن تكرّر انتقاله بلا مراجعة، ليعالجه المعلم قبل أن
     يتراكم». */
  if (kind === 'INCOMPLETE') {
    const entries = await db.dayEntry.findMany({
      where: { studentId: { in: ids }, day: { gte: from, lte: to }, incomplete: true },
      include: { lines: true },
      orderBy: { day: 'desc' },
    });
    const nameOf = new Map(students.map((s) => [s.id, s.fullName]));
    const byStudent = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = byStudent.get(e.studentId) ?? [];
      list.push(e);
      byStudent.set(e.studentId, list);
    }

    return NextResponse.json({
      kind, ...head,
      rows: [...byStudent.entries()]
        .map(([id, list]) => ({
          id,
          fullName: nameOf.get(id) ?? '',
          times: list.length,
          days: list.slice(0, 8).map((e) => ({
            day: e.day,
            assignmentNo: e.assignmentNo,
            /** Which line was left out — that is what a teacher acts on. */
            missing: e.lines.filter((l) => l.kind !== 'DARS' && !l.recited)
              .map((l) => PLAN_KIND_AR[l.kind as PlanKind] ?? l.kind),
          })),
        }))
        .sort((a, b) => b.times - a.times),
    });
  }

  /* ── المستحقون للاختبار — «مَن بلغ المقرّر ١٢ أو ٢٤ من طلابه، بمستوياتهم وتاريخ
     استحقاقهم، ومواعيد المحجوز منها». The sheet he sends to the supervisor. */
  if (kind === 'DUE') {
    const due = students.filter((s) => s.progress?.awaitingExam);
    const dueIds = due.map((s) => s.id);
    const bookings = dueIds.length
      ? await db.examBooking.findMany({
          where: { studentId: { in: dueIds }, status: 'BOOKED' },
          orderBy: { scheduledOn: 'asc' } })
      : [];
    const bookingOf = new Map<string, (typeof bookings)[number]>();
    for (const b of bookings) if (!bookingOf.has(b.studentId)) bookingOf.set(b.studentId, b);

    return NextResponse.json({
      kind, ...head,
      rows: due.map((s) => {
        const track = s.track as Track | null;
        return {
          id: s.id,
          fullName: s.fullName,
          trackAr: track ? TRACK_AR[track] : '—',
          level: s.progress?.level ?? null,
          assignmentNo: s.progress?.assignmentNo ?? null,
          badge: s.progress?.awaitingExam ?? null,
          badgeAr: badgeAr(s.progress?.awaitingExam ?? null),
          /** When the pointer stopped — «تاريخ استحقاقهم». */
          dueSince: s.progress?.updatedAt ? isoDate(s.progress.updatedAt) : null,
          bookedOn: bookingOf.get(s.id)?.scheduledOn ?? null,
        };
      }),
    });
  }

  /* ── فرسان الأسبوع — «في ما يُرسل ويُعلَّق» (client, 18 Sep 2026) ────────────
     NOT a ranking, and that is the difference between it and لوحة الشرف beside
     it: that one orders balances and always carries five names whoever did
     what; this one carries the names of everyone who did everything asked of
     him on every day his halaqa met this week — «الحضور — الثوب — التسميع
     كامل» — and that is none of them on a bad week and all of them on a good
     one. The rule is `knightOfWeek` in lib/teacher.ts, tested there, and the
     rows are read by lib/knights.ts, which the supervisor's own sheet reads
     too: one definition of a title children are named by. */
  if (kind === 'KNIGHTS') {
    const k = await knightsOfWeek({ to, halaqaId: who.halaqaId });
    return NextResponse.json({
      kind, ...head,
      from: k.from,
      halaqaDays: k.days.length,
      rows: k.rows,
      considered: k.considered,
    });
  }

  return fail('تقرير غير معروف.');
}
