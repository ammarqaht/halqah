import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope, fail } from '../_scope';
import { purchaseBlock, PURCHASE_BLOCK_AR } from '@/lib/points';
import { ORDER_STATUS_AR, type GiftStatus, type OrderStatus, type Track } from '@/lib/types';

/** طلباتي — mine only, newest first. */
export async function GET() {
  const g = await scope();
  if (!g.ok) return g.res;

  const orders = await db.order.findMany({
    where: { studentId: g.s.sub }, orderBy: { createdAt: 'desc' } });

  return NextResponse.json({
    orders: orders.map((o) => ({
      number: o.number, giftNameSnapshot: o.giftNameSnapshot, pointsSpent: o.pointsSpent,
      status: o.status, statusAr: ORDER_STATUS_AR[o.status as OrderStatus] ?? o.status,
      createdAt: o.createdAt.toISOString(),
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
    })),
  });
}

/* Buying. Both effects or neither: the shelf drops by one, the ledger drops by
   the price, and an order appears — inside one transaction.

   The stock claim is a conditional update for the same reason redemption's is:
   two boys tapping «شراء» on the last unit in the same instant must produce one
   order, not two. And the balance is recomputed INSIDE the transaction, never
   trusted from the request, so a stale page cannot spend points twice. */
export async function POST(req: Request) {
  const g = await scope();
  if (!g.ok) return g.res;

  const { giftId } = await req.json().catch(() => ({}));
  if (!giftId) return fail('اختر هدية.');

  const student = await db.student.findUnique({ where: { id: g.s.sub } });
  if (!student) return fail('لم يُعثر على الطالب.', 404);

  try {
    const result = await db.$transaction(async (tx) => {
      const gift = await tx.gift.findUnique({ where: { id: String(giftId) } });
      if (!gift) return { error: 'لم يُعثر على الهدية.' };

      const txns = await tx.pointTxn.findMany({
        where: { studentId: student.id }, select: { delta: true } });
      const balance = txns.reduce((n, t) => n + t.delta, 0);

      const block = purchaseBlock({ track: student.track as Track | null },
        { ...gift, status: gift.status as GiftStatus }, balance);
      if (block) return { error: PURCHASE_BLOCK_AR[block] };

      /* Claim the unit. Whoever loses this race is told the shelf is empty. */
      const took = await tx.gift.updateMany({
        where: { id: gift.id, quantity: { gte: 1 }, status: 'VISIBLE' },
        data: { quantity: { decrement: 1 } },
      });
      if (took.count === 0) return { error: PURCHASE_BLOCK_AR.OUT_OF_STOCK };

      /* «رقم طلبي ٧٣» — human, quotable at the desk, and allocated under the
         transaction's lock so two buyers cannot land on the same number. */
      const top = await tx.order.aggregate({ _max: { number: true } });
      const number = (top._max.number ?? 0) + 1;
      const id = `o-${student.id}-${Date.now()}`;

      await tx.pointTxn.create({
        data: {
          id: `tx-${id}`, studentId: student.id, delta: -gift.pointsCost,
          kind: 'PURCHASE', reason: `شراء — ${gift.name}`,
          refType: 'order', refId: id, createdBy: null,
        },
      });
      await tx.order.create({
        data: {
          id, number, studentId: student.id, giftId: gift.id,
          pointsSpent: gift.pointsCost, giftNameSnapshot: gift.name, status: 'PENDING',
        },
      });

      return { number, pointsSpent: gift.pointsCost, gift: gift.name,
               balance: balance - gift.pointsCost };
    });

    if ('error' in result && result.error) return fail(result.error);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return fail('تعذّر إتمام الطلب. أعد المحاولة.', 500);
  }
}
