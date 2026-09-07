import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';

/* The settings table already existed and nothing read it. These are the values
   §13.5 fixes but the client may want to move — what an exam is worth on each
   track — so they belong in the database rather than in a constant that only
   a redeploy can change. */
export async function GET() {
  if (!await readSession()) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const rows = await db.setting.findMany();
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

export async function PUT(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const patch = await req.json() as Record<string, unknown>;
  await db.$transaction(Object.entries(patch).map(([key, value]) =>
    db.setting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: { value: value as never },
    })));

  /* Points are money to a child. Who changed what they are worth, and when. */
  await db.auditLog.create({
    data: {
      actorId: s.sub, action: 'SETTINGS_UPDATE', entity: 'Setting',
      entityId: Object.keys(patch).join(','),
      after: patch as never,
    },
  }).catch(() => { /* the save itself matters more than its trail */ });

  return NextResponse.json({ ok: true });
}
