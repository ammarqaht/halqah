import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertMine, fail, scope, teacherSettings } from '../_scope';
import { cardsFor } from '@/lib/day';
import { dayHeading, daysInPeriod, inFuture } from '@/lib/teacher';
import { isoDate } from '@/lib/dates';

/* مع-٣-و، الوضع الثاني — «فترة لطالب».
   «يختار طالبًا وفترة من تاريخ إلى تاريخ، فيسجّل حضوره وتسميعه فيها كلها من
   شاشة واحدة. ولا يقبل النظام فترة لم تأتِ بعد، ولا يعرض فيها يومًا لا حلقة
   فيه.»

   Its axis is the other way round from the day screen: one student down a column
   of days. It is also «المكان الوحيد للتعديل» that the student's own file points
   at, so a teacher correcting a fortnight never has to open fourteen screens. */

/** A fortnight is the common case and a term is the outer one. Capped so a
    mistyped year cannot ask for four thousand days in one request. */
const MAX_DAYS = 120;

export async function GET(req: Request) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;

  const url = new URL(req.url);
  const studentId = String(url.searchParams.get('student') ?? '');
  const today = isoDate(new Date());
  const to = (url.searchParams.get('to') || today).slice(0, 10);
  const from = (url.searchParams.get('from')
    || isoDate(new Date(Date.now() - 13 * 86_400_000))).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return fail('تاريخ غير صحيح.');
  }
  if (from > to) return fail('بداية الفترة بعد نهايتها.');
  if (inFuture(from, today)) return fail('لا يمكن التسجيل على فترة لم تأتِ بعد.', 422);
  if (!studentId || !(await assertMine(who.halaqaId, studentId))) {
    return fail('هذا الطالب ليس في حلقتك.', 403);
  }

  const { weekdays, daily } = await teacherSettings(who.halaqaId);
  const days = daysInPeriod(from, to, weekdays, today).slice(-MAX_DAYS);

  /* One `cardsFor` per day would be one round trip per day. The period screen
     shows one student, so the cards are built for the whole halaqa once per day
     and his own is picked out — still one set of queries per day, which for a
     fortnight is ten, and the alternative is a second resolver to keep in step
     with the first. Correctness over a round trip we are not short of. */
  const rows = [];
  for (const day of days) {
    const cards = await cardsFor({ halaqaId: who.halaqaId, day, daily });
    const mine = cards.find((c) => c.studentId === studentId);
    if (mine) rows.push({ day, heading: dayHeading(day), card: mine });
  }

  const student = await db.student.findUnique({
    where: { id: studentId }, select: { fullName: true } });

  return NextResponse.json({
    student: { id: studentId, fullName: student?.fullName ?? '' },
    from, to,
    /* See the day route: the card's points box reads this, never the defaults. */
    daily,
    days: rows,
    counts: {
      days: rows.length,
      saved: rows.filter((r) => r.card.status !== null).length,
      absent: rows.filter((r) => r.card.status === 'ABSENT').length,
      recited: rows.filter((r) => r.card.lines.some((l) => l.recited)).length,
      points: rows.reduce((n, r) => n + r.card.points, 0),
    },
  });
}
