import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';

/* TRUNCATE, not DELETE. DELETE leaves dead tuples behind that only a later
   VACUUM reclaims — the rows disappear from queries while the disk they sat on
   stays billed. TRUNCATE frees the pages immediately and runs in constant time
   regardless of how many rows there were. */
const WIPE = [
  'halaqa_transfers',
  'import_runs',
  'audit_log',
  'students',
  'halaqat',
] as const;

/* Deliberately NOT wiped: admin_users (you would lock yourself out) and
   settings (the decided rules from §13, which are configuration, not data). */

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const started = Date.now();
  try {
    const before = {
      students: await db.student.count(),
      halaqat: await db.halaqa.count(),
      imports: await db.importRun.count(),
      audit: await db.auditLog.count(),
    };

    /* One statement: CASCADE settles the foreign keys, RESTART IDENTITY resets
       any sequences, and the whole thing is atomic. */
    await db.$executeRawUnsafe(
      `TRUNCATE TABLE ${WIPE.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`);

    await db.auditLog.create({
      data: {
        actorId: session.sub,
        action: 'RESET_DATA',
        entity: 'database',
        before: before as object,
        after: { students: 0, halaqat: 0, imports: 0, audit: 0 },
      },
    });

    return NextResponse.json({ ok: true, before, ms: Date.now() - started });
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر التصفير: ' + (e instanceof Error ? e.message : 'خطأ غير معروف') },
      { status: 500 });
  }
}
