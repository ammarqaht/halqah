import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { examView } from '@/lib/examView';

/** My exams, newest first, each with its questions. */
export async function GET() {
  const g = await scope();
  if (!g.ok) return g.res;

  /* His own sittings, each in full — «درجاته مع الأسئلة والأخطاء مثل الي تطلع
     للمشرف» (client, 9 Oct 2026). Scoped by his cookie, as before. */
  const exams = await db.exam.findMany({
    where: { studentId: g.s.sub },
    orderBy: [{ takenOn: 'desc' }, { createdAt: 'desc' }],
    include: { questions: true },
  });

  return NextResponse.json({ exams: exams.map(examView) });
}
