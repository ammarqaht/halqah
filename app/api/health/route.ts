import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/* Says exactly which link in the chain is broken. Deliberately reveals no
   data — counts and booleans only — so it is safe to leave reachable. */
export async function GET() {
  const out: Record<string, unknown> = {
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
      AUTH_SECRET_LENGTH_OK: (process.env.AUTH_SECRET?.length ?? 0) >= 32,
    },
  };

  try {
    await db.$queryRawUnsafe('SELECT 1');
    out.database = 'connected';
  } catch (e) {
    out.database = 'unreachable';
    out.databaseError = e instanceof Error ? e.message.split('\n')[0] : 'unknown';
    return NextResponse.json(out, { status: 503 });
  }

  try {
    const [admins, students, halaqat, settings] = await Promise.all([
      db.adminUser.count(), db.student.count(), db.halaqa.count(), db.setting.count(),
    ]);
    out.tables = 'migrated';
    out.counts = { admins, students, halaqat, settings };
    out.canSignIn = admins > 0;
    if (admins === 0) out.hint = 'الجداول موجودة لكن لا حساب مشرف — لم يعمل bootstrap.';
  } catch (e) {
    out.tables = 'missing';
    out.tablesError = e instanceof Error ? e.message.split('\n')[0] : 'unknown';
    out.hint = 'الاتصال قائم لكن الجداول غير موجودة — لم تُطبَّق الترحيلات.';
    return NextResponse.json(out, { status: 503 });
  }

  return NextResponse.json(out);
}
