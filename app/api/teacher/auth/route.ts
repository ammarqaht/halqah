import { NextResponse } from 'next/server';
import {
  authenticateTeacher, createTeacherSession, destroyTeacherSession,
  isTeacherLoginId, TEACHER_BAD, TEACHER_LOCKED, TEACHER_NO_HALAQA,
} from '@/lib/auth';
import { db } from '@/lib/db';
import { isDevLogin, DEV_NAME, DEV_SUB, DEV_TEACHER_ID } from '@/lib/dev';

/** مع-١ — sign in with a four-digit number from 2001 and a password. */
export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));

  /* حساب المطوّر — see lib/dev. Opens on the first halaqa; the band switches. */
  if (isDevLogin(username, password, 'teacher')) {
    const h = await db.halaqa.findFirst({ orderBy: { teacher: 'asc' }, select: { id: true } });
    if (!h) return NextResponse.json({ error: 'لا حلقات في النظام بعد.' }, { status: 404 });
    await createTeacherSession(
      { id: DEV_SUB, fullName: DEV_NAME, username: DEV_TEACHER_ID, halaqaId: h.id }, DEV_NAME);
    return NextResponse.json({ ok: true, mustChangePassword: false });
  }

  /* Rejected before the database is touched: a malformed entry is not a wrong
     one and must not spend an attempt against the lockout. */
  if (!isTeacherLoginId(username) || !String(password ?? '')) {
    return NextResponse.json({ error: TEACHER_BAD }, { status: 401 });
  }

  const r = await authenticateTeacher(String(username), String(password));
  if (!r.ok) {
    if (r.reason === 'LOCKED') {
      return NextResponse.json({ error: TEACHER_LOCKED }, { status: 429 });
    }
    if (r.reason === 'NO_HALAQA') {
      return NextResponse.json({ error: TEACHER_NO_HALAQA }, { status: 403 });
    }
    return NextResponse.json({ error: TEACHER_BAD }, { status: 401 });
  }

  await createTeacherSession({ ...r.teacher, username: r.username });
  return NextResponse.json({ ok: true, mustChangePassword: r.mustChangePassword });
}

export async function DELETE() {
  await destroyTeacherSession();
  return NextResponse.json({ ok: true });
}
