import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  authenticateStudent, createStudentSession, destroyStudentSession,
  BAD_CREDENTIALS, STUDENT_LOCKED, isPin,
} from '@/lib/auth';

/** Sign in with رقم الهوية + a five-digit PIN. */
export async function POST(req: Request) {
  const { username, pin } = await req.json().catch(() => ({}));

  /* Rejected before the database is touched — a malformed PIN is not a wrong
     PIN, and must not spend one of the five attempts. */
  if (!username || !isPin(pin)) return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 });

  const r = await authenticateStudent(String(username), String(pin));
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
