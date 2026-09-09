import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { balanceOf, earnsPoints } from '@/lib/points';
import { ajzaExact, ajzaForLevel } from '@/lib/exams';
import { TRACK_AR, LEVEL_MAX, type Track } from '@/lib/types';
import { halaqaLabel, shortName } from '@/lib/normalise';
import { levelsFor } from '@/lib/types';

/* Who is asking, and the handful of facts every screen needs about him.
   The balance is recomputed from the ledger on every request — §3.5: it is
   never a stored column, so it is structurally incapable of drifting. */
export async function GET() {
  const g = await scope();
  if (!g.ok) return g.res;

  const student = await db.student.findUnique({
    where: { id: g.s.sub },
    include: { credential: { select: { mustChangePin: true, username: true } } },
  });
  if (!student) return NextResponse.json({ error: 'لم يُعثر على الطالب.' }, { status: 404 });

  const halaqa = student.halaqaId
    ? await db.halaqa.findUnique({ where: { id: student.halaqaId } }) : null;

  const track = student.track as Track | null;
  const eligible = earnsPoints({ track });
  const txns = eligible
    ? await db.pointTxn.findMany({ where: { studentId: student.id }, select: { delta: true } })
    : [];

  /* His level, or the newest sheet he was handed. The roster's «المستوى الحالي»
     column is empty in the client's file, so the plan is often the only record
     of it — and a page that shows «المستوى 0» to a boy on level 60 is worse
     than one that shows nothing. */
  let level = student.currentLevel;
  if (level == null) {
    const newest = await db.studentPlan.findFirst({
      where: { studentId: student.id }, orderBy: { issuedAt: 'desc' }, select: { level: true } });
    level = newest?.level ?? null;
  }
  const total = track && track !== 'TALQEEN' ? levelsFor(track).length : 0;
  /* The level counts DOWN — 60 is the start of the silver track and 1 its end —
     so progress is how far the number has fallen, not how high it has risen. */
  const done = level != null && total ? Math.max(0, Math.min(total, total - level + 1)) : 0;

  return NextResponse.json({
    id: student.id,
    fullName: student.fullName,
    username: student.credential?.username ?? '',
    halaqaName: halaqa ? halaqaLabel(halaqa.name || halaqa.teacher) : null,
    teacher: halaqa ? halaqaLabel(shortName(halaqa.teacher)) : null,
    track,
    trackAr: track ? TRACK_AR[track] : null,
    grade: student.grade || null,
    stage: student.stage || null,
    currentLevel: level,
    /* `ajzaForLevel` returns null on a silver EVEN level because §4.8 gates
       association readiness on a WHOLE juz and must not round. For a boy
       reading his own page, «نصف جزء» is the true answer and «—» is not. */
    ajza: ajzaExact(track, level),
    ajzaWhole: ajzaForLevel(track, level),
    levelTotal: total,
    progressPct: total ? Math.round((done / total) * 100) : 0,
    eligibleForPoints: eligible,
    balance: eligible ? txns.reduce((n, t) => n + t.delta, 0) : 0,
    mustChangePin: student.credential?.mustChangePin ?? false,
    attendedDays: student.attendedDays,
  });
}
