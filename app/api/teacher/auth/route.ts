import { NextResponse } from 'next/server';
import {
  authenticateTeacher, createTeacherSession, destroyTeacherSession,
  isTeacherLoginId, TEACHER_BAD, TEACHER_LOCKED, TEACHER_NO_HALAQA,
} from '@/lib/auth';

/** مع-١ — sign in with a four-digit number from 2001 and a password. */
export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));

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
