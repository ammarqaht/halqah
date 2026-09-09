import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession, hashPin, isPin } from '@/lib/auth';

/* Edit one boy's account: his username, his PIN, or shut it.
   The supervisor sets the PIN himself here — a boy who forgot his is standing
   in front of him, and «choose one for him now» beats «here is a random one,
   memorise it». */
export async function PATCH(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const { studentId, username, pin, active } = await req.json().catch(() => ({}));
  if (!studentId) return NextResponse.json({ error: 'حدّد الطالب.' }, { status: 400 });

  const student = await db.student.findUnique({ where: { id: String(studentId) } });
  if (!student) return NextResponse.json({ error: 'لم يُعثر على الطالب.' }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (typeof username === 'string' && username.trim()) {
    const u = username.replace(/\s+/g, '').trim();
    const clash = await db.studentCredential.findUnique({ where: { username: u } });
    if (clash && clash.studentId !== student.id) {
      return NextResponse.json(
        { error: 'اسم الدخول هذا مستخدَم لطالب آخر.' }, { status: 409 });
    }
    data.username = u;
  }

  if (pin !== undefined && pin !== '') {
    if (!isPin(pin)) return NextResponse.json({ error: 'الرمز خمسة أرقام.' }, { status: 400 });
    data.pinHash = await hashPin(String(pin));
    /* Set by the supervisor, so the boy is asked to replace it — the same rule
       as a printed one, and for the same reason: someone else knows it. */
    data.mustChangePin = true;
    data.failedAttempts = 0;
    data.lockedUntil = null;
  }

  if (typeof active === 'boolean') data.active = active;
  if (!Object.keys(data).length) return NextResponse.json({ error: 'لا تغيير.' }, { status: 400 });

  const existing = await db.studentCredential.findUnique({ where: { studentId: student.id } });
  if (!existing) {
    if (!data.username) data.username = student.nationalId ?? student.id;
    if (!data.pinHash) return NextResponse.json(
      { error: 'هذا الطالب بلا حساب — اكتب له رمزًا لإنشائه.' }, { status: 400 });
    await db.studentCredential.create({
      data: {
        studentId: student.id,
        username: String(data.username),
        pinHash: String(data.pinHash),
        mustChangePin: true,
      },
    });
  } else {
    await db.studentCredential.update({ where: { studentId: student.id }, data });
  }

  await db.auditLog.create({
    data: { actorId: s.sub, action: 'STUDENT_CREDENTIAL_EDIT',
            entity: 'student_credential', entityId: student.id },
  }).catch(() => { /* the change matters more than the trail */ });

  return NextResponse.json({ ok: true });
}
