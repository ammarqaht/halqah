import { NextResponse } from 'next/server';
import { readStudentSession, type StudentSession } from '@/lib/auth';
import { earnsPoints } from '@/lib/points';
import { db } from '@/lib/db';

/* Every student route begins here.
   The id comes from the COOKIE and never from the request — a body carrying a
   studentId is the whole class of bug this surface exists to avoid. */
export async function scope(): Promise<
  { ok: true; s: StudentSession } | { ok: false; res: NextResponse }
> {
  const s = await readStudentSession();
  if (!s) return { ok: false, res: NextResponse.json({ error: 'غير مصرّح' }, { status: 401 }) };
  return { ok: true, s };
}

/* The points surface on top of `scope`.
   Hiding the tabs from a talqeen student is presentation, not a rule: the
   route still answered a request sent straight at it. Every route that moves
   points — earning, redeeming, buying — enters through here instead, and the
   track is read from the DATABASE, not from anything the caller sent. */
export async function pointsScope(): Promise<
  { ok: true; s: StudentSession } | { ok: false; res: NextResponse }
> {
  const g = await scope();
  if (!g.ok) return g;
  const student = await db.student.findUnique({
    where: { id: g.s.sub }, select: { track: true },
  });
  if (!student || !earnsPoints(student)) {
    return { ok: false, res: fail('نظام النقاط لا يشمل حلقات التلقين.', 403) };
  }
  return g;
}

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
