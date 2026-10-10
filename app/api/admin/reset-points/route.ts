import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bumpRev } from '@/lib/rev';
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

   The confirmation code lives in the dialog only, at the client's word: «ابي
   في رمز تحقق بيني وبين الموقع يدخله من اربع خانات … خله في ui يعني مايحتاج
   شغل تحقق» (10 Oct 2026). It is a second pair of hands on a lever with no
   undo, not a lock — the lock is the supervisor's session below, and a
   preview (3999) token never reaches here (middleware). */

const WIPE = ['orders', 'point_codes', 'point_code_batches', 'point_txns'] as const;


export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });


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

    /* Every open page's copy predates the reset — lib/rev. */
    await bumpRev(db);
    return NextResponse.json({ ok: true, before, ms: Date.now() - started });
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر التصفير.', detail: e instanceof Error ? e.message : '' },
      { status: 500 });
  }
}
