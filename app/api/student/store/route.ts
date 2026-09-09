import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { giftAvailability, shortBy, earnsPoints } from '@/lib/points';
import type { GiftStatus, Track } from '@/lib/types';

/* المتجر — طا-٤. Availability is decided HERE, not in the browser: a student
   who can afford nothing must still see everything, because the gap is the
   motivation — «لا يُخفى، ليكون حافزًا» — and a client-side check is a check
   anyone can edit. */
export async function GET() {
  const g = await scope();
  if (!g.ok) return g.res;

  const student = await db.student.findUnique({ where: { id: g.s.sub } });
  if (!student) return NextResponse.json({ error: 'لم يُعثر على الطالب.' }, { status: 404 });

  const eligible = earnsPoints({ track: student.track as Track | null });
  if (!eligible) return NextResponse.json({ eligible: false, balance: 0, gifts: [] });

  const [txns, gifts] = await Promise.all([
    db.pointTxn.findMany({ where: { studentId: student.id }, select: { delta: true } }),
    db.gift.findMany({ where: { status: 'VISIBLE' }, orderBy: { pointsCost: 'asc' } }),
  ]);
  const balance = txns.reduce((n, t) => n + t.delta, 0);

  return NextResponse.json({
    eligible: true,
    balance,
    gifts: gifts.map((gift) => ({
      id: gift.id, name: gift.name, description: gift.description,
      image: gift.image, pointsCost: gift.pointsCost,
      availability: giftAvailability({ ...gift, status: gift.status as GiftStatus }, balance),
      shortBy: shortBy(gift.pointsCost, balance),
    })),
  });
}
