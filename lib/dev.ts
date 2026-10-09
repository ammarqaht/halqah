/* حساب المطوّر — one sign-in on each portal for the person who builds this, to
   see how it runs for every halaqa and every boy without borrowing anyone's
   password.

   It is not a row in the database. It exists only while `DEV_PIN` is set in the
   environment, and it signs in on the ordinary login screens with a number no
   real account can hold: 2999 on the teacher's, 1999 on the student's (teachers
   are issued from 2001, boys from 1001). What it opens is a real teacher's or
   boy's view — a halaqa or a boy he picks from the band across the top — under a
   token marked `preview`, and the middleware refuses every write made under that
   mark. He can press every button; nothing is kept. */
import 'server-only';
import { timingSafeEqual } from 'node:crypto';

export const DEV_TEACHER_ID = '2999';
export const DEV_STUDENT_ID = '1999';
/** On the supervisor's sign-in: «اسم المستخدم» 3999. Read-only like the other
    two — it sees the whole system and the middleware refuses every write. */
export const DEV_ADMIN_ID = '3999';
/** What the token's `preview` carries, and the name the teacher portal shows. */
export const DEV_NAME = 'حساب المطوّر';
/** The teacher token's subject. No teacher has this id, so nothing reads as his. */
export const DEV_SUB = 'dev';

/** Digits only, at least eight, so it passes the student form's national-id
    shape as well as the teacher's password field. Unset → no such account. */
function pin() {
  const p = String(process.env.DEV_PIN ?? '').trim();
  return /^\d{8,}$/.test(p) ? p : null;
}

export function isDevLogin(username: unknown, password: unknown, portal: 'teacher' | 'student' | 'admin') {
  const p = pin();
  const id = portal === 'teacher' ? DEV_TEACHER_ID : portal === 'admin' ? DEV_ADMIN_ID : DEV_STUDENT_ID;
  if (!p || String(username ?? '').trim() !== id) return false;
  const a = Buffer.from(String(password ?? '').replace(/\D/g, ''));
  const b = Buffer.from(p);
  return a.length === b.length && timingSafeEqual(a, b);
}
