import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readStudentSession, createStudentSession } from '@/lib/auth';
import { DEV_NAME } from '@/lib/dev';

/* حساب المطوّر on the student's portal: which boy it is looking through, and the
   switch to another. Under /api/student/auth so the middleware lets the switch
   through — it writes nothing but the cookie, and only for the developer's own
   token: a boy's is refused here. */
async function dev() {
  const s = await readStudentSession();
  return s?.preview === DEV_NAME ? s : null;
}

export async function GET() {
  const s = await dev();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const [students, halaqat] = await Promise.all([
    db.student.findMany({
      where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, halaqaId: true },
    }),
    db.halaqa.findMany({ orderBy: { teacher: 'asc' }, select: { id: true, name: true, teacher: true } }),
  ]);
  return NextResponse.json({ current: s.sub, students, halaqat });
}

export async function POST(req: Request) {
  const s = await dev();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const { studentId } = await req.json().catch(() => ({}));
  const st = await db.student.findUnique({
    where: { id: String(studentId ?? '') },
    include: { credential: { select: { username: true } } },
  });
  if (!st) return NextResponse.json({ error: 'لم يُعثر على الطالب.' }, { status: 404 });
  await createStudentSession(
    { id: st.id, fullName: st.fullName, username: st.credential?.username ?? '' }, DEV_NAME);
  return NextResponse.json({ ok: true });
}
