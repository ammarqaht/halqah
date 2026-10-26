import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readTeacherSession, createTeacherSession } from '@/lib/auth';

/* المشرف نائبًا on the teacher's portal: which halaqa he is standing in for,
   and the switch to another (26 Oct 2026). Under /api/teacher/auth so the
   middleware lets the switch through — it writes nothing but the cookie, and
   only for a supervisor's own acting token: a teacher's is refused here, so a
   teacher can never move himself onto another halaqa. The account is re-read
   on every call, so a deactivated supervisor cannot switch. */
async function acting() {
  const s = await readTeacherSession();
  if (!s?.acting) return null;
  const a = await db.adminUser.findUnique({ where: { id: s.sub }, select: { active: true } });
  return a?.active ? s : null;
}

export async function GET() {
  const s = await acting();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const halaqat = await db.halaqa.findMany({
    orderBy: { teacher: 'asc' },
    select: { id: true, name: true, teacher: true, timeSlot: true },
  });
  return NextResponse.json({ current: s.halaqaId, halaqat, name: s.name });
}

export async function POST(req: Request) {
  const s = await acting();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const { halaqaId } = await req.json().catch(() => ({}));
  const h = await db.halaqa.findUnique({ where: { id: String(halaqaId ?? '') }, select: { id: true } });
  if (!h) return NextResponse.json({ error: 'لم يُعثر على الحلقة.' }, { status: 404 });
  /* Same end as the sign-in: switching halaqa does not lengthen his day. */
  await createTeacherSession(
    { id: s.sub, fullName: s.name, username: s.username, halaqaId: h.id }, null, true, s.exp);
  await db.auditLog.create({ data: {
    actorId: s.sub, action: 'ACTING_SWITCH', entity: 'Halaqa', entityId: h.id,
  } }).catch(() => { /* the switch matters more than its trail */ });
  return NextResponse.json({ ok: true });
}
