import { NextResponse } from 'next/server';
import { readStudentSession, type StudentSession } from '@/lib/auth';

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

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
