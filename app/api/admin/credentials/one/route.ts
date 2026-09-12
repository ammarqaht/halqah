import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession, hashPin, isLoginId, isNationalId } from '@/lib/auth';

/* Edit one boy's account: his login number, his password, or shut it.

   The password is normally his national id and needs no managing — that is the
   point of the scheme. This exists for the two cases it does not cover: a boy
   whose roster id was wrong and has been corrected, and a login number the
   supervisor wants to move. */
export async function PATCH(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { studentId, username, pin, active } = body;

  /* «صفّر دخولهم» — clear the last-sign-in stamps so the column reads clean
     before the cards go out. It touches nothing a student uses: not his
     number, not his password, not his points. It only forgets WHEN he last
     came, which is a record for the supervisor and nobody else. */
  if (body.clearLogins) {
    const r = await db.studentCredential.updateMany({
      data: { lastLoginAt: null, failedAttempts: 0, lockedUntil: null },
    });
    await db.auditLog.create({
      data: { actorId: s.sub, action: 'STUDENT_LOGINS_CLEARED',
              entity: 'student_credential', entityId: `${r.count} حساب` },
    }).catch(() => { /* the change matters more than its trail */ });
    return NextResponse.json({ ok: true, cleared: r.count });
  }
  if (!studentId) return NextResponse.json({ error: 'حدّد الطالب.' }, { status: 400 });

  const student = await db.student.findUnique({ where: { id: String(studentId) } });
  if (!student) return NextResponse.json({ error: 'لم يُعثر على الطالب.' }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (typeof username === 'string' && username.trim()) {
    const u = username.replace(/\s+/g, '').trim();
    if (!isLoginId(u)) {
      return NextResponse.json({ error: 'رقم الدخول أربعة أرقام.' }, { status: 400 });
    }
    const clash = await db.studentCredential.findUnique({ where: { username: u } });
    if (clash && clash.studentId !== student.id) {
      return NextResponse.json(
        { error: 'اسم الدخول هذا مستخدَم لطالب آخر.' }, { status: 409 });
    }
    data.username = u;
  }

  if (pin !== undefined && pin !== '') {
    if (!isNationalId(pin)) {
      return NextResponse.json({ error: 'كلمة المرور رقم الهوية — أربعة أرقام فأكثر.' }, { status: 400 });
    }
    data.pinHash = await hashPin(String(pin).replace(/\D/g, ''));
    data.mustChangePin = false;
    data.failedAttempts = 0;
    data.lockedUntil = null;
  }

  if (typeof active === 'boolean') data.active = active;
  if (!Object.keys(data).length) return NextResponse.json({ error: 'لا تغيير.' }, { status: 400 });

  const existing = await db.studentCredential.findUnique({ where: { studentId: student.id } });
  if (!existing) {
    if (!data.username) return NextResponse.json(
      { error: 'هذا الطالب بلا حساب — اكتب له رقم دخول لإنشائه.' }, { status: 400 });
    if (!data.pinHash) {
      if (!student.nationalId) return NextResponse.json(
        { error: 'هذا الطالب بلا رقم هوية — اكتب كلمة مرور بنفسك.' }, { status: 400 });
      data.pinHash = await hashPin(student.nationalId);
    }
    await db.studentCredential.create({
      data: {
        studentId: student.id,
        username: String(data.username),
        pinHash: String(data.pinHash),
        mustChangePin: false,
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
