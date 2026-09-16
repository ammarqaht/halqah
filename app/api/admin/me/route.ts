import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession, verifyPassword, hashPassword } from '@/lib/auth';

/* Who am I, and who else holds a key.
   Every supervisor sees the same data and holds the same powers — there is one
   role in this system and no second one to grant — so this lists them plainly
   rather than pretending at a hierarchy that does not exist. */
export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const all = await db.adminUser.findMany({
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, username: true, active: true, lastLoginAt: true },
  });

  return NextResponse.json({
    me: s.sub,
    name: s.name,
    supervisors: all.map((u) => ({
      ...u,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    })),
  });
}

/** Change MY OWN password. Never anyone else's — a supervisor who forgets his
    is reset by another from the same screen, and that is a separate action. */
export async function PUT(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const { current, next } = await req.json().catch(() => ({}));
  const pw = String(next ?? '');

  if (pw.length < 8) {
    return NextResponse.json({ error: 'كلمة المرور ثمانية أحرف فأكثر.' }, { status: 400 });
  }

  const me = await db.adminUser.findUnique({ where: { id: s.sub } });
  if (!me) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  /* The current password is required even though the session already proves
     who this is: it is what stops a walked-away laptop becoming a permanent
     one. */
  if (!(await verifyPassword(String(current ?? ''), me.passwordHash))) {
    return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة.' }, { status: 400 });
  }

  await db.adminUser.update({
    where: { id: me.id }, data: { passwordHash: await hashPassword(pw) },
  });
  await db.auditLog.create({
    data: { actorId: me.id, action: 'ADMIN_PASSWORD_CHANGE', entity: 'admin_user', entityId: me.id },
  }).catch(() => { /* the change matters more than the trail */ });

  return NextResponse.json({ ok: true });
}
