import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';

/* تصفير النقاط وسجلّها — «أضف زرًّا أسفل صفحة النقاط لتصفير النقاط وسجل النقاط،
   ونافذة تأكيد بنفس طريقة تصفير البيانات» (client, 18 Sep 2026).

   A NARROWER LEVER THAN «تصفير البيانات», and deliberately so. That one empties
   the mosque; this one empties the economy and leaves every student, halaqa,
   plan, exam and registered day exactly where it was. What goes:

     point_txns          every movement — and a balance IS the sum of them
     point_codes         the cards that were printed, and their batches
     point_code_batches
     orders              what was bought with the points being erased

   What stays and why: `gifts` is a SHELF, not a transaction — the prices and
   the stock are configuration the supervisor typed, and wiping them would make
   him type the shop again to reset a ledger. And nothing that records what a
   boy DID is touched: his days, his recitation, his exams and his مقرّر are the
   record of a term's work, and they are not money.

   THE PHRASE IS CHECKED ON THE SERVER, for the same reason it is on the full
   reset: a check that lives only in a dialog is a check anyone can skip by
   calling the endpoint. It is not a secret — it is a second pair of hands on a
   lever that has no undo. */

const WIPE = ['orders', 'point_codes', 'point_code_batches', 'point_txns'] as const;

const RESET_PHRASE = process.env.RESET_PHRASE || '2026';

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const { phrase } = await req.json().catch(() => ({}));
  if (String(phrase ?? '').trim() !== RESET_PHRASE) {
    return NextResponse.json({ error: 'الرمز غير صحيح.' }, { status: 403 });
  }

  const started = Date.now();
  try {
    const before = {
      txns: await db.pointTxn.count(),
      codes: await db.pointCode.count(),
      orders: await db.order.count(),
    };

    await db.$executeRawUnsafe(
      `TRUNCATE TABLE ${WIPE.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`);

    /* The supervisor's browser holds its own copy of the points tables, and the
       server cannot push. The same mark the full reset leaves is left here, so
       the next device to open empties itself rather than helpfully uploading a
       stale ledger back over an empty one. */
    await db.setting.upsert({
      where: { key: 'reset_at' },
      create: { key: 'reset_at', value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });

    await db.auditLog.create({
      data: {
        actorId: session.sub,
        action: 'RESET_POINTS',
        entity: 'points',
        before: before as object,
        after: { txns: 0, codes: 0, orders: 0 },
      },
    });

    return NextResponse.json({ ok: true, before, ms: Date.now() - started });
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر التصفير.', detail: e instanceof Error ? e.message : '' },
      { status: 500 });
  }
}
