import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  authenticateStudent, createStudentSession, destroyStudentSession,
  BAD_CREDENTIALS, STUDENT_LOCKED, isLoginId, isNationalId,
} from '@/lib/auth';
import { isDevLogin, DEV_NAME } from '@/lib/dev';

/** Sign in with a four-digit login number and the boy's own national id. */
export async function POST(req: Request) {
  const { username, pin } = await req.json().catch(() => ({}));

  /* حساب المطوّر — see lib/dev. Opens as the first boy; the band switches. */
  if (isDevLogin(username, pin, 'student')) {
    const st = await db.student.findFirst({
      where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' },
      include: { credential: { select: { username: true } } },
    });
    if (!st) return NextResponse.json({ error: 'لا طلاب في النظام بعد.' }, { status: 404 });
    await createStudentSession(
      { id: st.id, fullName: st.fullName, username: st.credential?.username ?? '' }, DEV_NAME);
    return NextResponse.json({ ok: true, mustChangePin: false });
  }

  /* Rejected before the database is touched — a malformed entry is not a wrong
     one, and must not spend an attempt. */
  if (!isLoginId(username) || !isNationalId(pin)) {
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 });
  }

  const r = await authenticateStudent(String(username), String(pin).replace(/\D/g, ''));
  if (!r.ok) {
    return NextResponse.json(
      { error: r.reason === 'LOCKED' ? STUDENT_LOCKED : BAD_CREDENTIALS },
      { status: r.reason === 'LOCKED' ? 429 : 401 });
  }

  await createStudentSession({ ...r.student, username: r.username });
  return NextResponse.json({ ok: true, mustChangePin: r.mustChangePin });
}

export async function DELETE() {
  await destroyStudentSession();
  return NextResponse.json({ ok: true });
}
