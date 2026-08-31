/* Sessions: bcrypt for the password, a jose JWT in an httpOnly cookie for the
   session. Same shape as Attendance/lib/auth.ts, so the pattern is familiar. */
import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const COOKIE = 'halqah_session';
const DAYS = 7;

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
    .setExpirationTime(`${DAYS}d`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DAYS * 24 * 60 * 60,
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
