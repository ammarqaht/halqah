import { NextResponse } from 'next/server';
import { readSession, readTeacherSession, type TeacherSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { readWeekdays, weekdaysFor, readDaily, WEEKDAYS_KEY, DAILY_POINTS_KEY,
  type DailyPointsSettings } from '@/lib/settings';

/* Every teacher route begins here.
   The halaqa comes from the COOKIE and never from the request. A body carrying
   a halaqaId is the whole class of bug this surface exists to avoid, and it is
   a worse one here than on the student surface: a teacher guessing another id
   would be reading twenty-five other boys' levels, attendance and exam
   results — «لا يرى غيرها: لا طلاب غيره، ولا أرقام الحلقات الأخرى». */

export type Who = {
  /** The teacher, or the supervisor registering for an absent one. */
  id: string;
  name: string;
  role: 'TEACHER' | 'SUPERVISOR';
  /** The halaqa this request may touch, and no other. */
  halaqaId: string;
};

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Who is asking, and which halaqa he may see.
 *
 * A teacher's own halaqa comes from his token — he cannot ask for another, and
 * `?halaqa=` on his request is ignored rather than honoured.
 *
 * The supervisor is also let in, and this is not a loophole: «لا يوجد معلم
 * بديل. فإذا غاب المعلم فتح المشرف شاشة التسجيل نفسها على حلقته وسجّل عنه،
 * ويظهر في السجل باسم المشرف لا باسم المعلم» (§٦). So he may name any halaqa,
 * and everything he saves is stamped `SUPERVISOR` with his own name. One
 * screen, one set of routes, two chairs — rather than a second registration
 * screen built beside the first and drifting from it.
 */
export async function scope(req: Request): Promise<
  { ok: true; who: Who; s: TeacherSession | null } | { ok: false; res: NextResponse }
> {
  const t = await readTeacherSession();
  if (t) {
    if (!t.halaqaId) return { ok: false, res: fail('حسابك لم يُربط بحلقة بعد.', 403) };
    return {
      ok: true,
      who: { id: t.sub, name: t.name, role: 'TEACHER', halaqaId: t.halaqaId },
      s: t,
    };
  }

  const admin = await readSession();
  if (admin) {
    const asked = new URL(req.url).searchParams.get('halaqa');
    if (!asked) return { ok: false, res: fail('اختر الحلقة.', 400) };
    const exists = await db.halaqa.findUnique({ where: { id: asked }, select: { id: true } });
    if (!exists) return { ok: false, res: fail('لم يُعثر على الحلقة.', 404) };
    return {
      ok: true,
      who: { id: admin.sub, name: admin.name, role: 'SUPERVISOR', halaqaId: asked },
      s: null,
    };
  }

  return { ok: false, res: fail('غير مصرّح', 401) };
}

/**
 * The roster this request is allowed to write to.
 *
 * «المنقطعون لا يظهرون، والطالب الجديد يظهر فور إسناده إلى الحلقة» — so ACTIVE
 * only, in a fixed order. The order is the same on every screen and every save:
 * «بترتيب ثابت لا يتغيّر، لأن المعلم يحفظ مواضعها بعينه». A list that reshuffles
 * because a name was edited is a list a teacher stops trusting.
 */
export const rosterOf = (halaqaId: string) => db.student.findMany({
  where: { halaqaId, status: 'ACTIVE' },
  orderBy: [{ fullName: 'asc' }],
});

/** Refuses a student who is not in this request's halaqa. The id is checked
    against the DATABASE, not against a list the caller sent. */
export async function assertMine(halaqaId: string, studentId: string) {
  const s = await db.student.findFirst({
    where: { id: studentId, halaqaId },
    select: { id: true },
  });
  return !!s;
}

/** The two settings every teacher route reads, in one round trip. */
export async function teacherSettings(halaqaId: string): Promise<{
  weekdays: number[];
  daily: DailyPointsSettings;
}> {
  const rows = await db.setting.findMany({
    where: { key: { in: [WEEKDAYS_KEY, DAILY_POINTS_KEY] } },
  });
  const find = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
  return {
    weekdays: weekdaysFor(readWeekdays(find(WEEKDAYS_KEY)), halaqaId),
    daily: readDaily(find(DAILY_POINTS_KEY)),
  };
}
