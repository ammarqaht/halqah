import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPin, isPin } from '@/lib/auth';
import { scope, fail } from '../_scope';
import bcrypt from 'bcryptjs';

/** Change my own PIN. The only thing on this surface a student may rewrite. */
export async function POST(req: Request) {
  const g = await scope();
  if (!g.ok) return g.res;

  const { current, next } = await req.json().catch(() => ({}));
  if (!isPin(next)) return fail('الرمز الجديد خمسة أرقام.');
  if (String(current) === String(next)) return fail('اختر رمزًا يختلف عن الحالي.');
  /* «١١١١١» and «١٢٣٤٥» are the two a child picks and the two anyone guesses. */
  if (/^(\d)\1{4}$/.test(String(next))) return fail('لا تجعل الأرقام كلها متشابهة.');
  if ('0123456789'.includes(String(next)) || '9876543210'.includes(String(next))) {
    return fail('لا تجعل الأرقام متتابعة.');
  }

  const cred = await db.studentCredential.findUnique({ where: { studentId: g.s.sub } });
  if (!cred) return fail('لا يوجد حساب لهذا الطالب.', 404);
  if (!(await bcrypt.compare(String(current ?? ''), cred.pinHash))) {
    return fail('الرمز الحالي غير صحيح.', 401);
  }

  await db.studentCredential.update({
    where: { id: cred.id },
    data: { pinHash: await hashPin(String(next)), mustChangePin: false },
  });
  return NextResponse.json({ ok: true });
}
