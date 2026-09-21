import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isoDate } from '@/lib/dates';
import { weekOf, weekDays, shiftWeek } from '@/lib/week';

/* أسبوع طالب واحد — للمشرف.
 *
 * The same week the boy sees in his own portal, read by the supervisor from
 * his card in المتابعة. It is deliberately a separate route from the halaqa
 * register: that one pulls a whole roster to answer «كيف حال الحلقة؟», and
 * paying for seventeen boys to look at one is the kind of waste that made the
 * supervisor's first load ninety seconds.
 */

const STATUS_AR: Record<string, string> = {
  PRESENT: 'حاضر', LATE: 'متأخر', ABSENT: 'غائب',
};
const KIND_AR: Record<string, string> = {
  DARS: 'الدرس', MURAJAA_SUGHRA: 'المراجعة الصغرى', MURAJAA_KUBRA: 'المراجعة الكبرى',
};
/** Review before the new — the order it is recited in and printed in. */
const KIND_ORDER = ['MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS'];

export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const studentId = q.get('student');
  if (!studentId) return NextResponse.json({ error: 'اختر طالبًا.' }, { status: 400 });

  const today = isoDate(new Date());
  const thisWeek = weekOf(today);
  const asked = q.get('week');
  const week = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= thisWeek
    ? weekOf(asked) : thisWeek;

  const days = weekDays(week);
  const [entries, ever] = await Promise.all([
    db.dayEntry.findMany({
      where: { studentId, day: { gte: days[0], lte: days[days.length - 1] } },
      include: { lines: true },
    }),
    db.dayEntry.count({ where: { studentId } }),
  ]);
  const byDay = new Map(entries.map((e) => [e.day, e]));

  const rows = days.map((day) => {
    const e = byDay.get(day);
    /* «لم يُسجَّل» — and that is all it says. It is not absence. */
    if (!e) return { day, status: null, statusAr: null, future: day > today, lines: [], recited: 0 };

    const lines = [...e.lines]
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
      .map((l) => ({
        kind: l.kind, kindAr: KIND_AR[l.kind] ?? l.kind,
        recited: l.recited, errors: l.errors, note: l.note || null,
      }));

    return {
      day, future: false,
      status: e.status as string,
      statusAr: STATUS_AR[e.status] ?? e.status,
      thobe: e.thobe,
      assignmentNo: e.assignmentNo,
      incomplete: e.incomplete,
      note: e.note || null,
      savedBy: e.savedByName || null,
      lines,
      recited: lines.filter((l) => l.recited).length,
    };
  });

  const seen = rows.filter((r) => r.status !== null);

  return NextResponse.json({
    today, week,
    prevWeek: shiftWeek(week, -1),
    nextWeek: week < thisWeek ? shiftWeek(week, 1) : null,
    isThisWeek: week === thisWeek,
    days: rows,
    ever,
    summary: {
      recorded: seen.length,
      present: seen.filter((r) => r.status === 'PRESENT').length,
      late: seen.filter((r) => r.status === 'LATE').length,
      absent: seen.filter((r) => r.status === 'ABSENT').length,
      recited: rows.filter((r) => (r.recited ?? 0) > 0).length,
    },
  });
}
