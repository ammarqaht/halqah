import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { balances, earnsPoints } from '@/lib/points';
import { TRACK_AR, TXN_KIND_AR, type TxnKind, type Track } from '@/lib/types';
import { isoDate } from '@/lib/dates';
import { shortName } from '@/lib/normalise';

/* مع-٧ — شاشة نقاط حلقتي.
   «أرصدة طلابه · حركات النقاط لكل طالب بمصادرها · لوحة شرف الحلقة · وطلبات
   المتجر لطلابه عرضًا فقط.»

   Nothing here grants, deducts, or delivers: «منح أيّ نقاط خارج الثابتة» and
   «تسليم هدايا المتجر» are both on the teacher's cannot list (§٦), so there is
   no POST on this route at all. The screen has no button the server would have
   to refuse. */

/** «لوحة شرف الحلقة: أعلى خمسة طلاب». */
const HONOUR = 5;

export async function GET(req: Request) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;

  const students = await db.student.findMany({
    where: { halaqaId: who.halaqaId, status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
  });
  /* «وطلاب التلقين خارج هذا كله: لا نقاط لهم ولا متجر ولا ترتيب» — excluded from
     the balances, the board and the orders, on the server. */
  const earning = students.filter((s) => earnsPoints({ track: s.track as Track | null }));
  const ids = earning.map((s) => s.id);

  if (!ids.length) {
    return NextResponse.json({
      students: [], moves: [], honour: [], orders: [],
      total: 0, talqeenOnly: students.length > 0,
    });
  }

  const [txns, orders] = await Promise.all([
    db.pointTxn.findMany({ where: { studentId: { in: ids } }, orderBy: { createdAt: 'desc' } }),
    db.order.findMany({
      where: { studentId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 40 }),
  ]);

  const asRows = txns.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }));
  const bal = balances(asRows as never);
  const nameOf = new Map(earning.map((s) => [s.id, s.fullName]));

  const rows = earning.map((s) => {
    const b = bal.get(s.id);
    const track = s.track as Track | null;
    return {
      id: s.id,
      fullName: s.fullName,
      shortName: shortName(s.fullName),
      trackAr: track ? TRACK_AR[track] : null,
      balance: b?.balance ?? 0,
      granted: b?.granted ?? 0,
      redeemed: b?.redeemed ?? 0,
      deducted: b?.deducted ?? 0,
      lastAt: b?.lastAt ?? null,
    };
  });

  /* Ties share a place and consume the ones beneath them — 1, 2, 2, 4 — the same
     rule `lib/rank.ts` uses for the student's board, so the sheet the teacher
     pins on the wall and the screen a boy reads cannot disagree.

     A ZERO is not a place. Before the halaqa's first registered day every boy
     has nothing, and shared places would put the whole roster on the board at
     second — nine names on zero points, which is not an honour board, it is a
     roster with a ribbon on it. The supervisor's own لوحة الشرف has always
     filtered this way (`/print/honour`); this one now agrees with it.

     And the board is still capped at five NAMES, not five places: a five-way tie
     at the top is a real outcome and all five belong on the wall, but a tie
     lower down must not push the sheet past what «أعلى خمسة» promised. */
  const ranked = [...rows]
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance || a.fullName.localeCompare(b.fullName, 'ar'));
  const honour: (typeof ranked[number] & { place: number })[] = [];
  let place = 0;
  let seen = 0;
  let last: number | null = null;
  for (const r of ranked) {
    seen++;
    if (last === null || r.balance !== last) { place = seen; last = r.balance; }
    if (place > HONOUR || honour.length >= HONOUR) break;
    honour.push({ ...r, place });
  }

  return NextResponse.json({
    students: rows,
    total: rows.reduce((n, r) => n + r.balance, 0),
    honour,
    /** «حركات النقاط لكل طالب بمصادرها: نقاط يومية · اختبارات · أكواد · مشتريات
        · خصم» — dated by the day they belong to, not the day they were typed. */
    moves: asRows.slice(0, 120).map((t) => ({
      id: t.id,
      studentId: t.studentId,
      studentName: shortName(nameOf.get(t.studentId) ?? ''),
      delta: t.delta,
      kind: t.kind,
      kindAr: TXN_KIND_AR[t.kind as TxnKind] ?? t.kind,
      reason: t.reason,
      on: t.effectiveOn ?? isoDate(new Date(t.createdAt)),
    })),
    /** «عرضًا فقط، ليجيب من سأله عن طلبه — والتسليم عندكم وحدكم». */
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      studentName: shortName(nameOf.get(o.studentId) ?? ''),
      gift: o.giftNameSnapshot,
      pointsSpent: o.pointsSpent,
      status: o.status,
      createdAt: isoDate(o.createdAt),
    })),
  });
}
