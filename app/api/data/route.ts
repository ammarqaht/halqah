import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { toStudent, toHalaqa } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

/** Everything the screens read. One round trip, one shape. */
export async function GET() {
  if (!await readSession()) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  try {
    const [students, halaqat, lastImport] = await Promise.all([
      db.student.findMany({ orderBy: { fullName: 'asc' } }),
      db.halaqa.findMany({ orderBy: { name: 'asc' } }),
      db.importRun.findFirst({ orderBy: { importedAt: 'desc' } }),
    ]);
    return NextResponse.json({
      students: students.map(toStudent),
      halaqat: halaqat.map(toHalaqa),
      importedAt: lastImport?.importedAt ?? null,
      sourceFile: lastImport?.fileName ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'قاعدة البيانات غير جاهزة', detail: e instanceof Error ? e.message.split('\n')[0] : '' },
      { status: 503 });
  }
}
