import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { knightsOfWeek } from '@/lib/knights';
import { lastWeekEnd } from '@/lib/week';
import { halaqaLabel, shortName } from '@/lib/normalise';

/* فرسان الأسبوع — the supervisor's Sunday card.

   «بشكل اسبوعي كل احد يكون فيه اشعار للمشرف وللطلاب وللمعلمين عن فرسان
   الأسبوع» (client, 10 Oct 2026). The teacher's and the boys' cards are
   computed alerts in their own lists; the supervisor has no such list, so this
   answers for him: last week's knights across every halaqa, and whether THIS
   supervisor has already seen this week's. Seen-ness rides the same
   `release_views` table as «ما الجديد», keyed `knights:<saturday>`. */

const keyFor = (to: string) => `knights:${to}`;

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const to = lastWeekEnd();
  const k = await knightsOfWeek({ to });
  const seen = await db.releaseView.findUnique({
    where: { audience_userId_releaseId: { audience: 'admin', userId: s.sub, releaseId: keyFor(to) } },
  }).catch(() => null);

  /* Grouped by halaqa, in the order the knights sheet prints them. */
  const groups = new Map<string, string[]>();
  for (const r of k.rows) {
    const name = halaqaLabel(shortName(r.halaqaName));
    groups.set(name, [...(groups.get(name) ?? []), shortName(r.fullName)]);
  }

  return NextResponse.json({
    to, from: k.from, count: k.rows.length, seen: !!seen,
    groups: [...groups].map(([halaqa, names]) => ({ halaqa, names })),
  });
}

export async function POST() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const to = lastWeekEnd();
  await db.releaseView.createMany({
    data: [{ audience: 'admin', userId: s.sub, releaseId: keyFor(to) }], skipDuplicates: true,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
