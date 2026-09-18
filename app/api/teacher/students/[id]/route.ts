import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertMine, fail, scope } from '../../_scope';
import { absence, hijri, type DayRecord } from '@/lib/teacher';
import { balanceOf, earnsPoints, EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { ajzaExact, daysSince, isLate } from '@/lib/exams';
import { isoDate } from '@/lib/dates';
import { TRACK_AR, PLAN_KIND_AR, type PlanKind, type Track } from '@/lib/types';

/* مع-٤-ب — ملف الطالب من عين معلمه.
   «والملف كله للعرض لا للتعديل: فإن أراد المعلم تصحيح أيام هذا الطالب انتقل إلى
   وضع فترة لطالب في التسجيل، وهو المكان الوحيد للتعديل.»

   And what is deliberately NOT here: «ولا مكان لملاحظة سلوكية ولا بيان صحي، كما
   قرّرتم» — and no guardian phone: «ولا أرقام أولياء الأمور معروضة للمعلم».
   Neither is hidden by the screen; neither is sent. */

/** How much of his attendance grid to send: three months of squares is what
    «شبكة الحضور: أيام الشهر في مربعات ملوّنة» needs, plus the two before it so a
    teacher can scroll back without a second request. */
const GRID_DAYS = 92;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;

  const { id } = await ctx.params;
  if (!(await assertMine(who.halaqaId, id))) {
    return fail('هذا الطالب ليس في حلقتك.', 403);
  }

  const student = await db.student.findUniqueOrThrow({
    where: { id },
    include: { progress: true },
  });
  const track = (student.track as Track | null) ?? null;
  const today = isoDate(new Date());

  const [txns, plans, exams, bookings, entries, transfers] = await Promise.all([
    db.pointTxn.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' }, take: 60 }),
    db.studentPlan.findMany({ where: { studentId: id }, orderBy: { issuedAt: 'desc' } }),
    db.exam.findMany({ where: { studentId: id }, orderBy: { takenOn: 'desc' } }),
    db.examBooking.findMany({
      where: { studentId: id, status: 'BOOKED', scheduledOn: { gte: today } },
      orderBy: { scheduledOn: 'asc' } }),
    db.dayEntry.findMany({
      where: { studentId: id,
        day: { gte: isoDate(new Date(Date.now() - GRID_DAYS * 86_400_000)) } },
      include: { lines: true },
      orderBy: { day: 'desc' } }),
    /* «وإن جاء من حلقة أخرى ظهر تاريخه كله، ويفصل خطّ ما كان قبل انتقاله». */
    db.halaqaTransfer.findMany({ where: { studentId: id }, orderBy: { movedAt: 'desc' } }),
  ]);

  const plan = plans[0] ?? null;
  const level = student.progress?.level ?? plan?.level ?? student.currentLevel ?? null;
  const eligible = earnsPoints({ track });

  /* مواضع تكرار الخطأ — «السور التي كثرت فيها أخطاؤه في التسميع، تُجمع من خانة
     الأخطاء ومن سور المقرّر». The errors live on the line and the سورة lives in
     the level's curriculum, so the two are joined on the مقرّر the day recorded. */
  const curriculum = plan
    ? await db.curriculumDay.findMany({ where: { track: plan.track, level: plan.level } })
    : [];
  const surahErrors = new Map<string, number>();
  for (const e of entries) {
    if (e.assignmentNo == null) continue;
    for (const l of e.lines) {
      if (!l.errors) continue;
      const row = curriculum.find((c) => c.dayNo === e.assignmentNo && c.kind === l.kind);
      const surah = row?.fromSurah?.trim();
      if (!surah) continue;
      surahErrors.set(surah, (surahErrors.get(surah) ?? 0) + l.errors);
    }
  }

  const a = absence(entries.map((e): DayRecord => ({ day: e.day, status: e.status })), today);

  /* The line that separates what happened before he moved here. Null when he
     has always been in this halaqa, which is the ordinary case. */
  const arrivedOn = transfers.find((t) => t.toHalaqaId === who.halaqaId)?.movedAt ?? null;

  return NextResponse.json({
    student: {
      id: student.id,
      fullName: student.fullName,
      track,
      trackAr: track ? TRACK_AR[track] : null,
      grade: student.grade || null,
      stage: student.stage || null,
      level,
      ajza: ajzaExact(track, level),
      assignmentNo: student.progress?.assignmentNo ?? null,
      assignmentOf: plan?.dayCount ?? 0,
      awaitingExam: student.progress?.awaitingExam ?? null,
      /** «يحتاج مراجعة قبل الاختبار» — ما رفعه معلّمه، إن رفعه. */
      examHold: student.progress?.examHoldAt
        ? {
            at: student.progress.examHoldAt.toISOString(),
            by: student.progress.examHoldBy ?? '',
            note: student.progress.examHoldNote,
          }
        : null,
      balance: eligible ? balanceOf(
        txns.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })) as never, id) : null,
      eligibleForPoints: eligible,
      /** «تاريخ تسليم ورقته، والمدة المنقضية» — and whether it is overdue. */
      planIssuedAt: plan?.issuedAt ?? null,
      planDaysHeld: plan ? daysSince(plan.issuedAt) : null,
      lateOnLevel: isLate(plan),
      /** The line in his file, when he came from another halaqa. */
      arrivedOn: arrivedOn ? isoDate(arrivedOn) : null,
      /** From رتل, and labelled as such wherever it is shown — it is a COUNT of
          days with no dates behind it, and must never be mixed with the grid
          below, which has a row per day. */
      ratelAttendedDays: student.attendedDays,
    },

    /** شبكة الحضور — one square per registered day. A day that was never
        registered is absent from this list entirely, which is how the grid shows
        «يوم لا حلقة فيه» without a holidays table to consult. */
    grid: entries.map((e) => ({
      day: e.day,
      status: e.status,
      thobe: e.thobe,
      incomplete: e.incomplete,
    })),

    absence: { streak: a.streak, inWindow: a.inWindow, flagged: a.flagged, days: a.days },

    /** سجل التسميع — «بالتاريخ والمقرّر والأسطر الثلاثة وعدد الأخطاء والملاحظة،
        وعلامة على الأيام الناقصة». */
    recitation: entries
      .filter((e) => e.lines.length > 0)
      .map((e) => ({
        day: e.day,
        hijri: hijri(e.day),
        assignmentNo: e.assignmentNo,
        level: e.level,
        incomplete: e.incomplete,
        note: e.note,
        savedByName: e.savedByName,
        savedByRole: e.savedByRole,
        lines: e.lines.map((l) => ({
          kind: l.kind as PlanKind,
          kindAr: PLAN_KIND_AR[l.kind as PlanKind] ?? l.kind,
          recited: l.recited,
          errors: l.errors,
          /** «ملاحظة على المقرّر» — shown beside the line it belongs to. */
          note: l.note,
        })),
      })),

    /** مساره بين المستويات — «بتواريخها، فيُرى بالعين من أسرع ومن تعثّر». */
    levels: plans.map((p) => ({
      level: p.level, track: p.track, issuedAt: p.issuedAt,
      daysHeld: daysSince(p.issuedAt), dayCount: p.dayCount,
    })),

    /** اختباراته — «عرضًا لا تعديلًا»، ومواعيد المحجوز منها. */
    exams: exams.map((e) => ({
      id: e.id,
      type: e.type,
      typeAr: EXAM_TYPE_AR[e.type as ExamType] ?? e.type,
      takenOn: e.takenOn,
      level: e.level,
      ajza: e.ajza,
      errors: e.errors,
      warnings: e.warnings,
      tajweedErrors: e.tajweedErrors,
      score: e.score,
      passed: e.passed,
      pointsAwarded: e.pointsAwarded,
      examiner: e.examiner,
      note: e.note,
    })),
    bookings: bookings.map((b) => ({
      id: b.id, scheduledOn: b.scheduledOn, badge: b.badge, level: b.level,
      daysAway: Math.max(0, Math.round(
        (Date.parse(`${b.scheduledOn}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000)),
    })),

    /** مواضع تكرار الخطأ, heaviest first. */
    errorSpots: [...surahErrors.entries()]
      .map(([surah, errors]) => ({ surah, errors }))
      .sort((x, y) => y.errors - x.errors)
      .slice(0, 8),

    ledger: eligible
      ? txns.map((t) => ({
          id: t.id, delta: t.delta, kind: t.kind, reason: t.reason,
          on: t.effectiveOn ?? isoDate(t.createdAt),
        }))
      : [],
  });
}
