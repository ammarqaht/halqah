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

/* ─────────────────────────────────────────────────────────────────────────────
   Teacher sessions.

   A third cookie and a third JWT audience. The three are never interchangeable:
   a teacher's token presented to an admin route is refused on its audience, and
   so is a supervisor's at a teacher route. They are different people, not
   different permissions on one account — and this one matters most of the
   three, because a teacher's token must open ONE halaqa and no other.
   ───────────────────────────────────────────────────────────────────────── */

const TEACHER_COOKIE = 'halqah_teacher';

/**
 * Thirty days, and it does NOT lapse on idleness.
 *
 * «فالمعلم يفتح جواله بين طلابه ولا يحتمل دخولًا كل عصر» — the supervisor's
 * thirty minutes protects a laptop left open on a mosque desk, and applying it
 * here would sign a teacher out in the middle of التسميع, standing in front of
 * twenty-five boys, which is exactly how a portal stops being used.
 *
 * Shorter than the student's half-year on purpose: his phone carries his whole
 * halaqa's record — every boy's level, attendance and exam results — where a
 * boy's carries only his own.
 */
export const TEACHER_SESSION_DAYS = 30;

/**
 * Sign-in is a four-digit LOGIN NUMBER from 2001, and a password.
 *
 * Four digits keeps both portals on one shape — «ليكون النظام واحدًا» — and
 * 2001 upward keeps a teacher's number clear of the students' 1001–1117, so a
 * number read off the wrong sheet opens nothing rather than somebody else's
 * screen.
 *
 * The password is NOT his national id. The students' is, deliberately and with
 * its reasoning recorded above; a teacher's is not, for two reasons. He holds a
 * hundred and seventeen boys' levels, attendance and exam results, where a boy
 * holds only his own. And his screen is open in a room full of the people who
 * would most like to read it. The supervisor sets it, he replaces it on first
 * use, and the supervisor can reset it when he forgets.
 */
export const TEACHER_ID_FIRST = 2001;
export const isTeacherLoginId = (v: unknown) => /^2\d{3}$/.test(String(v ?? ''));

/** «٢٠٠١، ٢٠٠٢، …» — in halaqa order, so a column of them reads down a sheet. */
export const teacherLoginIdFor = (index: number) => String(TEACHER_ID_FIRST + index);

/** Eight characters at least. He types this once a month, not once an afternoon,
    so it can afford to be a real password — and it guards more than his own row. */
export const TEACHER_PASSWORD_MIN = 8;

export type TeacherSession = {
  sub: string; name: string; username: string;
  /** His one halaqa, carried in the token so no route has to trust a body. */
  halaqaId: string | null;
};

export async function createTeacherSession(t: {
  id: string; fullName: string; username: string; halaqaId: string | null;
}) {
  const token = await new SignJWT({ name: t.fullName, username: t.username, halaqaId: t.halaqaId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(t.id)
    .setAudience('teacher')
    .setIssuedAt()
    .setExpirationTime(`${TEACHER_SESSION_DAYS}d`)
    .sign(secret());

  (await cookies()).set(TEACHER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TEACHER_SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function readTeacherSession(): Promise<TeacherSession | null> {
  const token = (await cookies()).get(TEACHER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: 'teacher' });
    return {
      sub: String(payload.sub),
      name: String(payload.name ?? ''),
      username: String(payload.username ?? ''),
      halaqaId: payload.halaqaId ? String(payload.halaqaId) : null,
    };
  } catch {
    return null;
  }
}

export async function destroyTeacherSession() {
  (await cookies()).delete(TEACHER_COOKIE);
}

export async function requireTeacherSession(): Promise<TeacherSession> {
  const s = await readTeacherSession();
  if (!s) throw new Error('UNAUTHENTICATED');
  return s;
}

/* The same lockout the students have, and for a stronger reason: a four-digit
   number is a small space to guess in, and what is behind a teacher's is a
   whole halaqa. */
export const TEACHER_MAX_ATTEMPTS = 5;
export const TEACHER_LOCK_MINUTES = 10;
export const TEACHER_LOCKED = 'حاولت مرات كثيرة. انتظر عشر دقائق ثم أعد المحاولة.';
/** Never says which field was wrong — §٧: «ورسالة الخطأ لا تكشف أيّ الحقلين». */
export const TEACHER_BAD = 'رقم الدخول أو كلمة المرور غير صحيحة.';

export type TeacherAuthResult =
  | {
      ok: true;
      teacher: { id: string; fullName: string; halaqaId: string | null };
      username: string;
      mustChangePassword: boolean;
    }
  | { ok: false; reason: 'BAD' | 'LOCKED' | 'NO_HALAQA' };

export async function authenticateTeacher(
  username: string, password: string,
): Promise<TeacherAuthResult> {
  const u = String(username ?? '').replace(/\s+/g, '').trim();
  const t = u
    ? await db.teacher.findUnique({ where: { username: u }, include: { halaqa: true } })
    : null;

  /* Hash a dummy when there is no such account, so a wrong number and a wrong
     password take the same time and cannot be told apart by timing. */
  if (!t || !t.active) {
    await bcrypt.compare(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    return { ok: false, reason: 'BAD' };
  }

  if (t.lockedUntil && t.lockedUntil > new Date()) return { ok: false, reason: 'LOCKED' };

  if (!(await verifyPassword(password, t.passwordHash))) {
    const failed = t.failedAttempts + 1;
    await db.teacher.update({
      where: { id: t.id },
      data: failed >= TEACHER_MAX_ATTEMPTS
        ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + TEACHER_LOCK_MINUTES * 60_000) }
        : { failedAttempts: failed },
    });
    return { ok: false, reason: failed >= TEACHER_MAX_ATTEMPTS ? 'LOCKED' : 'BAD' };
  }

  /* A correct password on an account with no halaqa yet. Letting him in would
     open a portal whose every screen is about a halaqa he does not have, and
     each one would have to invent an empty state for a case that is really an
     unfinished setup. He is told so plainly instead. */
  if (!t.halaqa) return { ok: false, reason: 'NO_HALAQA' };

  await db.teacher.update({
    where: { id: t.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return {
    ok: true,
    teacher: { id: t.id, fullName: t.fullName, halaqaId: t.halaqa.id },
    username: t.username,
    mustChangePassword: t.mustChangePassword,
  };
}

export const TEACHER_NO_HALAQA =
  'حسابك لم يُربط بحلقة بعد. راجع مشرف الحلقات.';
