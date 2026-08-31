import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';

/** What the database actually holds, and how much room it takes. */
export async function GET() {
  if (!await readSession()) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  try {
    const [students, halaqat, imports, audit, size] = await Promise.all([
      db.student.count(),
      db.halaqa.count(),
      db.importRun.count(),
      db.auditLog.count(),
      db.$queryRawUnsafe<{ bytes: bigint }[]>(
        `SELECT pg_database_size(current_database()) AS bytes;`),
    ]);
    return NextResponse.json({
      students, halaqat, imports, audit,
      bytes: Number(size[0]?.bytes ?? 0),
    });
  } catch {
    return NextResponse.json({ error: 'قاعدة البيانات غير متصلة' }, { status: 503 });
  }
}
