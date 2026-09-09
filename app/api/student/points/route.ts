import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { TXN_KIND_AR, type TxnKind } from '@/lib/types';
import { LEDGER_PAGE } from '@/content/student';

/** My ledger, newest first. Scoped by the cookie — never by a query parameter. */
export async function GET(req: Request) {
  const g = await scope();
  if (!g.ok) return g.res;

  const limit = Math.min(200, Number(new URL(req.url).searchParams.get('limit')) || LEDGER_PAGE);
  const moves = await db.pointTxn.findMany({
    where: { studentId: g.s.sub },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const all = await db.pointTxn.findMany({
    where: { studentId: g.s.sub }, select: { delta: true } });

  return NextResponse.json({
    balance: all.reduce((n, t) => n + t.delta, 0),
    moves: moves.map((t) => ({
      id: t.id, delta: t.delta, kind: t.kind,
      kindAr: TXN_KIND_AR[t.kind as TxnKind] ?? t.kind,
      reason: t.reason, createdAt: t.createdAt.toISOString(),
    })),
  });
}
