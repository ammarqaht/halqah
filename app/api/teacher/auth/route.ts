import { NextResponse } from 'next/server';
import {
  authenticate, BAD_CREDENTIALS,
  authenticateTeacher, createTeacherSession, destroyTeacherSession,
  isTeacherLoginId, TEACHER_BAD, TEACHER_LOCKED, TEACHER_NO_HALAQA,
} from '@/lib/auth';
import { db } from '@/lib/db';
import { isDevLogin, DEV_NAME, DEV_SUB, DEV_TEACHER_ID } from '@/lib/dev';
import { ipOf, isLocked, recordFailure, clearFailures, LOCKED_AR } from '@/lib/loginLimit';

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

  /* المشرف نائبًا عن معلم غائب — «يعطيهم صلاحية يدخلون لأي حساب معلم متغيب
     ويسجلون عنه تحضير الطلاب وكل شيء» (client, 26 Oct 2026). A supervisor
     signs in HERE with his own account — his long number, not a teacher's four
     digits — and opens on the first halaqa; the band across the top switches.
     His own credentials rather than a shared code, so the register says which
     supervisor wrote each day. */
  const u = String(username ?? '').trim();
  if (!isTeacherLoginId(u) && u.length >= 3 && String(password ?? '')) {
    /* The supervisor's own sign-in has a lockout; this second door has the
       same one, or it would be the easy way to guess his password. */
    const ip = ipOf(req);
    if (isLocked(u, ip)) return NextResponse.json({ error: LOCKED_AR }, { status: 429 });
    let admin;
    try {
      admin = await authenticate(u, String(password));
    } catch {
      return NextResponse.json({ error: 'تعذّر الاتصال بقاعدة البيانات.' }, { status: 503 });
    }
    if (!admin) {
      recordFailure(u, ip);
      return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 });
    }
    clearFailures(u, ip);
    const h = await db.halaqa.findFirst({ orderBy: { teacher: 'asc' }, select: { id: true } });
    if (!h) return NextResponse.json({ error: 'لا حلقات في النظام بعد.' }, { status: 404 });
    await createTeacherSession(
      { id: admin.id, fullName: admin.fullName, username: admin.username, halaqaId: h.id }, null, true);
    await db.auditLog.create({ data: {
      actorId: admin.id, action: 'ACTING_SIGN_IN', entity: 'Halaqa', entityId: h.id,
    } }).catch(() => { /* the sign-in matters more than its trail */ });
    return NextResponse.json({ ok: true, mustChangePassword: false, acting: true });
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
