import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { issueMissingTeachers, resetTeacherPassword, type IssuedTeacher } from '@/lib/credentials';

/* حسابات المعلمين — the supervisor's half of §٦.
   «ينشئه المشرف من بوابة الإدارة ويربطه بحلقته … والمشرف يعيد تعيينها إن نسيها.»

   Nothing here is typed twice: the seven names are already in the halaqa cards,
   so an account is DERIVED from the card rather than entered. What the
   supervisor does on this screen is press one button and read out a number and a
   temporary password. */

const guard = async () => (await readSession()) ?? null;

export async function GET() {
  const s = await guard();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const [teachers, halaqat] = await Promise.all([
    db.teacher.findMany({ orderBy: { username: 'asc' }, include: { halaqa: true } }),
    db.halaqa.findMany({ orderBy: { name: 'asc' },
      select: { id: true, name: true, teacher: true, teacherId: true } }),
  ]);

  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      username: t.username,
      active: t.active,
      mustChangePassword: t.mustChangePassword,
      lockedUntil: t.lockedUntil?.toISOString() ?? null,
      lastLoginAt: t.lastLoginAt?.toISOString() ?? null,
      halaqa: t.halaqa ? { id: t.halaqa.id, name: t.halaqa.name } : null,
    })),
    /** Halaqat still waiting for an account — the list the button acts on. */
    pending: halaqat.filter((h) => !h.teacherId).map((h) => ({
      id: h.id, name: h.name, teacher: h.teacher,
    })),
  });
}

/**
 * Issue the missing accounts, or reset one password.
 *
 * The plain passwords come back ONCE, in this response, and are never stored in
 * the clear — «يعيّنها المشرف ويغيّرها المعلم في أول دخول». If he closes the
 * screen before writing them down, the fix is another reset, not a lookup.
 */
export async function POST(req: Request) {
  const s = await guard();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? 'ISSUE');

  try {
    if (action === 'ISSUE') {
      let issued: IssuedTeacher[] = [];
      let unnamed: string[] = [];
      await db.$transaction(async (tx) => {
        const r = await issueMissingTeachers(tx, body.halaqaIds);
        issued = r.issued; unnamed = r.unnamed;
      });
      await db.auditLog.create({
        data: {
          actorId: s.sub, action: 'ISSUE_TEACHER_ACCOUNTS', entity: 'teachers',
          after: { count: issued.length, unnamed } as object,
        },
      });
      return NextResponse.json({ ok: true, issued, unnamed });
    }

    if (action === 'RESET') {
      const id = String(body.teacherId ?? '');
      const t = await db.teacher.findUnique({ where: { id } });
      if (!t) return NextResponse.json({ error: 'لم يُعثر على المعلم.' }, { status: 404 });
      let password = '';
      await db.$transaction(async (tx) => { password = await resetTeacherPassword(tx, id); });
      await db.auditLog.create({
        data: {
          actorId: s.sub, action: 'RESET_TEACHER_PASSWORD', entity: 'teachers', entityId: id,
        },
      });
      return NextResponse.json({ ok: true, teacherId: id, fullName: t.fullName, password });
    }

    if (action === 'TOGGLE') {
      const id = String(body.teacherId ?? '');
      const t = await db.teacher.findUnique({ where: { id } });
      if (!t) return NextResponse.json({ error: 'لم يُعثر على المعلم.' }, { status: 404 });
      /* «إيقاف معلم لا يمسّ بيانات حلقته ولا سجّلها السابق» — so this flips one
         boolean and touches nothing else. His halaqa keeps its roster, its days
         and its record; he simply cannot sign in. */
      await db.teacher.update({ where: { id }, data: { active: !t.active } });
      await db.auditLog.create({
        data: {
          actorId: s.sub, action: t.active ? 'SUSPEND_TEACHER' : 'RESUME_TEACHER',
          entity: 'teachers', entityId: id,
        },
      });
      return NextResponse.json({ ok: true, active: !t.active });
    }

    return NextResponse.json({ error: 'إجراء غير معروف.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر التنفيذ.', detail: e instanceof Error ? e.message : '' },
      { status: 500 });
  }
}
