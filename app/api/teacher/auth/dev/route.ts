import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readTeacherSession, createTeacherSession } from '@/lib/auth';
import { DEV_NAME, DEV_SUB, DEV_TEACHER_ID } from '@/lib/dev';

/* حساب المطوّر on the teacher's portal: which halaqa it is looking at, and the
   switch to another. Under /api/teacher/auth so the middleware lets the switch
   through — it writes nothing but the cookie, and only for the developer's own
   token: a teacher's, or no token at all, is refused here. */
async function dev() {
  const s = await readTeacherSession();
  return s?.preview === DEV_NAME ? s : null;
}

export async function GET() {
  const s = await dev();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const halaqat = await db.halaqa.findMany({
    orderBy: { teacher: 'asc' },
    select: { id: true, name: true, teacher: true, timeSlot: true },
  });
  return NextResponse.json({ current: s.halaqaId, halaqat });
}

export async function POST(req: Request) {
  const s = await dev();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const { halaqaId } = await req.json().catch(() => ({}));
  const h = await db.halaqa.findUnique({ where: { id: String(halaqaId ?? '') }, select: { id: true } });
  if (!h) return NextResponse.json({ error: 'لم يُعثر على الحلقة.' }, { status: 404 });
  await createTeacherSession(
    { id: DEV_SUB, fullName: DEV_NAME, username: DEV_TEACHER_ID, halaqaId: h.id }, DEV_NAME);
  return NextResponse.json({ ok: true });
}
