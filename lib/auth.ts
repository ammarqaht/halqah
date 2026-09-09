/* Sessions: bcrypt for the password, a jose JWT in an httpOnly cookie for the
   session. Same shape as Attendance/lib/auth.ts, so the pattern is familiar. */
import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const COOKIE = 'halqah_session';

/**
 * How long a session survives with NOTHING happening.
 *
 * The token itself expires after this, and the cookie with it — so an idle
 * timeout enforced only in the browser (a redirect anyone can skip by pressing
 * Back) is not what this is. The server stops accepting the cookie.
 *
 * Every request the supervisor makes while working re-issues it, so the clock
 * measures idleness rather than session length: he is never signed out
 * mid-sentence, and a laptop left open on the mosque desk is signed out.
 *
 * It was five. Reading four workbooks' previews before pressing «اعتماد» takes
 * longer than that without touching the keyboard, so the token lapsed mid-task
 * and the upload failed — quietly, because the failure was reported as being
 * offline. Thirty still signs out a laptop left on the desk.
 */
export const IDLE_MINUTES = 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_SECRET is missing or shorter than 32 characters. Set it in the environment.');
  }
  return new TextEncoder().encode(s);
}

export type Session = { sub: string; name: string; role: 'SUPERVISOR' };

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export async function createSession(user: { id: string; fullName: string }) {
  const token = await new SignJWT({ name: user.fullName, role: 'SUPERVISOR' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setAudience('admin')
    .setIssuedAt()
    .setExpirationTime(`${IDLE_MINUTES}m`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: IDLE_MINUTES * 60,
  });
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: 'admin' });
    return { sub: String(payload.sub), name: String(payload.name), role: 'SUPERVISOR' };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Throws if there is no session — for use at the top of every admin action. */
export async function requireSession(): Promise<Session> {
  const s = await readSession();
  if (!s) throw new Error('UNAUTHENTICATED');
  return s;
}

/** Generic message on purpose: never reveal which field was wrong. */
export const BAD_CREDENTIALS = 'رقم الهوية أو كلمة المرور غير صحيحة.';

export async function authenticate(username: string, password: string) {
  const user = await db.adminUser.findUnique({ where: { username: username.trim() } });
  /* Hash a dummy when the user is missing, so a wrong username and a wrong
     password take the same time and cannot be told apart by timing. */
  if (!user || !user.active) {
    await bcrypt.compare(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Student sessions.

   A separate cookie and a separate JWT audience. The two are never
   interchangeable: an admin token presented to a student route is rejected on
   its audience, and a student token to an admin route likewise. That is the
   whole point of splitting them — one supervisor's laptop and a hundred and
   seventeen boys' phones do not belong on the same credential.
   ───────────────────────────────────────────────────────────────────────── */

const STUDENT_COOKIE = 'halqah_student';

/**
 * Half a year, re-issued on every authenticated request — so in practice a boy
 * signs in once and stays in.
 *
 * The supervisor's thirty minutes protects a laptop left open on a desk in a
 * public mosque. A boy's phone is in his pocket, and asking a nine year old to
 * re-enter his number between one halaqa and the next is how a portal stops
 * being used. What guards a shared phone is the sign-out button, which is
 * always one tap away — not an expiry that punishes everyone for it.
 */
export const STUDENT_IDLE_DAYS = 180;

/**
 * Sign-in is a four-digit LOGIN NUMBER and the boy's own national id.
 *
 * The login number is short enough to hand a six year old and to type on a
 * phone; the national id is a thing he already knows and cannot lose, which
 * is the whole point — nothing to memorise and nothing to reissue.
 *
 * It is not a secret, and this file does not pretend it is: a teacher, a
 * classmate and the roster all know a boy's national id. What it protects
 * against is a boy opening another boy's page by guessing a number between
 * 1001 and 1117 — which the lockout below makes impractical. Anything more
 * sensitive than a boy's own level and points would need a real password.
 */
export const LOGIN_ID_LENGTH = 4;
export const LOGIN_ID_FIRST = 1001;

export const isLoginId = (v: unknown) => /^\d{4}$/.test(String(v ?? ''));
/** The national id as the roster holds it — digits only, any length it uses. */
export const isNationalId = (v: unknown) => /^\d{4,}$/.test(String(v ?? '').replace(/\D/g, ''));

export type StudentSession = { sub: string; name: string; username: string };

export async function createStudentSession(s: { id: string; fullName: string; username: string }) {
  const token = await new SignJWT({ name: s.fullName, username: s.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.id)
    .setAudience('student')
    .setIssuedAt()
    .setExpirationTime(`${STUDENT_IDLE_DAYS}d`)
    .sign(secret());

  (await cookies()).set(STUDENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STUDENT_IDLE_DAYS * 24 * 60 * 60,
  });
}

export async function readStudentSession(): Promise<StudentSession | null> {
  const token = (await cookies()).get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: 'student' });
    return {
      sub: String(payload.sub),
      name: String(payload.name ?? ''),
      username: String(payload.username ?? ''),
    };
  } catch {
    return null;
  }
}

export async function destroyStudentSession() {
  (await cookies()).delete(STUDENT_COOKIE);
}

/** Throws if there is no student session — for the top of every student route. */
export async function requireStudentSession(): Promise<StudentSession> {
  const s = await readStudentSession();
  if (!s) throw new Error('UNAUTHENTICATED');
  return s;
}

/* Five digits is a hundred thousand combinations. Thin on its own — which is
   why this is not optional: five wrong tries shuts the account for ten
   minutes, so a guesser gets thirty attempts an hour. */
export const STUDENT_MAX_ATTEMPTS = 5;
export const STUDENT_LOCK_MINUTES = 10;
export const STUDENT_LOCKED = 'حاولت مرات كثيرة. انتظر عشر دقائق ثم أعد المحاولة.';

export type StudentAuthResult =
  | { ok: true; student: { id: string; fullName: string }; username: string; mustChangePin: boolean }
  | { ok: false; reason: 'BAD' | 'LOCKED' };

export async function authenticateStudent(
  username: string, pin: string,
): Promise<StudentAuthResult> {
  const u = String(username ?? '').replace(/\s+/g, '').trim();
  const cred = u
    ? await db.studentCredential.findUnique({ where: { username: u }, include: { student: true } })
    : null;

  /* Hash a dummy when there is no such account, so a wrong id and a wrong PIN
     take the same time and cannot be told apart. */
  if (!cred || !cred.active) {
    await bcrypt.compare(pin, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    return { ok: false, reason: 'BAD' };
  }

  if (cred.lockedUntil && cred.lockedUntil > new Date()) return { ok: false, reason: 'LOCKED' };

  if (!(await bcrypt.compare(pin, cred.pinHash))) {
    const failed = cred.failedAttempts + 1;
    await db.studentCredential.update({
      where: { id: cred.id },
      data: failed >= STUDENT_MAX_ATTEMPTS
        ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + STUDENT_LOCK_MINUTES * 60_000) }
        : { failedAttempts: failed },
    });
    return { ok: false, reason: failed >= STUDENT_MAX_ATTEMPTS ? 'LOCKED' : 'BAD' };
  }

  await db.studentCredential.update({
    where: { id: cred.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return {
    ok: true,
    student: { id: cred.student.id, fullName: cred.student.fullName },
    username: cred.username,
    mustChangePin: cred.mustChangePin,
  };
}

export const hashPin = (secret: string) => bcrypt.hash(secret, 12);

/** «١٠٠١، ١٠٠٢، …» — sequential, so a teacher can read a column of them out. */
export const loginIdFor = (index: number) => String(LOGIN_ID_FIRST + index);
