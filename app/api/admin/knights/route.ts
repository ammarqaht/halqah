import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { knightsOfWeek } from '@/lib/knights';
import { isoDate } from '@/lib/dates';
import { lastWeekEnd } from '@/lib/week';

/* فرسان الأسبوع — عند المشرف، للمسجد كله أو لحلقة واحدة.
   «ويكون فيه صفحة لطباعة أسماء الفرسان عند المشرف» (client, 18 Sep 2026).

   It reads the same `lib/knights.ts` the teacher's own sheet reads, so the title
   means one thing in the mosque. Each halaqa is judged on ITS OWN registered
   days: a halaqa that met four times this week must not cost its boys the title
   because the halaqa next to it met five.

   A teacher's token never reaches `/api/admin/*` — the middleware refuses it on
   its audience — so this needs no halaqa scoping of its own. */

export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const url = new URL(req.url);
  const today = isoDate(new Date());
  /* Last week, Sunday to Saturday — the same week the Sunday card announces.
     «7 days ending today» on a Sunday was Monday-to-Sunday: it dropped last
     Sunday and judged boys on today's half-registered halaqa. */
  const to = (url.searchParams.get('to') || lastWeekEnd()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'تاريخ غير صحيح.' }, { status: 400 });
  }

  const halaqaId = url.searchParams.get('halaqa') || null;
  const k = await knightsOfWeek({ to, halaqaId });

  return NextResponse.json({ ...k, halaqaDays: k.days.length, today });
}
