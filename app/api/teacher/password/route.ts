import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  hashPassword, readTeacherSession, verifyPassword, TEACHER_PASSWORD_MIN,
} from '@/lib/auth';
import { fail } from '../_scope';

/* «وكلمة مرور يعيّنها المشرف ويغيّرها المعلم في أول دخول، والمشرف يعيد تعيينها
   إن نسيها» (§٦). This is the teacher's half: changing his own.

   Only a teacher, never the supervisor standing in for one — «تغيير كلمة مروره»
   is on the teacher's own list, and a supervisor who needs to reset it has the
   accounts screen for that. So this reads the teacher cookie directly rather
   than going through `scope`. */
export async function POST(req: Request) {
  const s = await readTeacherSession();
  if (!s) return fail('غير مصرّح', 401);

  const { current, next } = await req.json().catch(() => ({}));
  const nextPw = String(next ?? '');

  if (nextPw.length < TEACHER_PASSWORD_MIN) {
    return fail(`كلمة المرور ${TEACHER_PASSWORD_MIN} أحرف على الأقل.`);
  }

  const t = await db.teacher.findUnique({ where: { id: s.sub } });
  if (!t) return fail('لم يُعثر على الحساب.', 404);

  /* The current password is required even on the first change. He was handed a
     temporary one, he has just typed it to get here, and requiring it is what
     stops a phone left unlocked on a desk from having its password changed by
     whoever picks it up. */
  if (!(await verifyPassword(String(current ?? ''), t.passwordHash))) {
    return fail('كلمة المرور الحالية غير صحيحة.', 401);
  }
  if (await verifyPassword(nextPw, t.passwordHash)) {
    return fail('كلمة المرور الجديدة هي نفسها الحالية.');
  }

  await db.teacher.update({
    where: { id: t.id },
    data: { passwordHash: await hashPassword(nextPw), mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
