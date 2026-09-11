import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { earnsPoints } from '@/lib/points';
import { boardWindow, rankBoard, standingOf } from '@/lib/rank';
import { halaqaLabel, shortName } from '@/lib/normalise';
import { PODIUM } from '@/content/student';
import type { Track } from '@/lib/types';

/* ─────────────────────────────────────────────────────────────────────────────
   الترتيب — the one screen on this surface that is ALLOWED to name another boy,
   and the reason it is written carefully.

   Everything else under /api/student answers only about the boy asking. A board
   cannot: a place is meaningless without the places either side of it. So this
   route is the deliberate, narrow exception, and it gives up as little as the
   feature can survive on:

   • Only what لوحة الشرف already posts. The printed honour roll (approved PDF
     §8) is pinned to the halaqa wall carrying the top ten boys' names and their
     points, in `shortName` form. This shows the same two facts in the same
     form, so nothing here is readable on a phone that is not already readable
     on the wall.
   • Names, never identifiers. No id, no national id, no level, no halaqa, no
     grade — the rows carry a place, a name and a figure, and a positional key.
     A leaked id is a handle for probing every other route; a name on a wall is
     not.
   • The WINDOW is cut here, not in the browser. A boy ranked ninetieth is sent
     the head of the board and his own neighbourhood — never the other hundred
     and sixteen rows for his phone to scroll past.
   • His own name in full, everyone else's shortened. He should recognise his
     own row at a glance; he does not need anyone else's father's name.
   ───────────────────────────────────────────────────────────────────────── */

export async function GET(req: Request) {
  const g = await scope();
  if (!g.ok) return g.res;

  const me = await db.student.findUnique({
    where: { id: g.s.sub },
    select: { id: true, fullName: true, track: true, halaqaId: true },
  });
  if (!me) return NextResponse.json({ error: 'لم يُعثر على الطالب.' }, { status: 404 });

  /* Talqeen is outside the points system (القرار المعتمد ١), so there is no
     board for him to be on and none for him to read. */
  if (!earnsPoints({ track: me.track as Track | null })) {
    return NextResponse.json({ error: 'الترتيب لطلاب المسارات.' }, { status: 403 });
  }

  const wide = new URL(req.url).searchParams.get('scope') === 'all';

  const students = await db.student.findMany({
    where: {
      status: 'ACTIVE',
      track: { in: ['SILVER', 'GOLDEN'] },
      ...(wide ? {} : { halaqaId: me.halaqaId }),
    },
    select: { id: true, fullName: true },
  });

  /* One grouped read rather than a query per boy. A student with no ledger row
     at all is absent from this and falls through to zero — he is competing,
     just not yet scoring. */
  const sums = await db.pointTxn.groupBy({
    by: ['studentId'],
    _sum: { delta: true },
    where: { studentId: { in: students.map((s) => s.id) } },
  });
  const points = new Map(sums.map((r) => [r.studentId, r._sum.delta ?? 0]));

  const board = rankBoard(students.map((s) => ({
    id: s.id, fullName: s.fullName, points: points.get(s.id) ?? 0,
  })));

  const mine = standingOf(board, me.id);
  const { rows, gapAfter } = boardWindow(board, me.id);

  /* The shape that leaves this server. Note what is NOT in it. */
  const out = (r: { id: string; fullName: string; points: number; rank: number }, i: number) => ({
    key: String(i),
    rank: r.rank,
    name: r.id === me.id ? r.fullName : shortName(r.fullName),
    points: r.points,
    me: r.id === me.id,
  });

  const halaqa = !wide && me.halaqaId
    ? await db.halaqa.findUnique({ where: { id: me.halaqaId }, select: { name: true, teacher: true } })
    : null;

  return NextResponse.json({
    scope: wide ? 'all' : 'halaqa',
    podium: board.slice(0, PODIUM).map(out),
    rows: rows.map((r, i) => out(r, i + PODIUM)),
    gapAfter,
    total: board.length,
    mine: mine ? { rank: mine.rank, total: mine.total, points: mine.points } : null,
    halaqat: wide ? await db.halaqa.count() : null,
    teacher: halaqa ? halaqaLabel(shortName(halaqa.teacher)) : null,
  });
}
