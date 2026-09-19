import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { summariseAll, totalFor, type DayRow } from '@/lib/attendance';

/* حصيلة الحضور والتسميع للتقارير.
 *
 * The printed reports read the browser's store, and the store carries nothing
 * the teachers write — `PUT /api/state` deliberately never touches their
 * tables. So every report that showed «أيام الحضور» was showing the imported
 * roster file's term total: one number per boy, correct until the next upload,
 * unable to name a day, and wrong about this afternoon from the moment the
 * teachers' portal shipped.
 *
 * This is the register's own arithmetic, in the shape a report needs: a summary
 * per student, and one for the halaqa. Reports fetch it and print what it says.
 *
 * `from`/`to` are optional and inclusive. Without them it is everything ever
 * recorded, which is what a student's comprehensive report wants; with them it
 * is a period, which is what a halaqa sheet for a term wants.
 */
export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const halaqaId = q.get('halaqa');
  const studentId = q.get('student');
  const from = q.get('from');
  const to = q.get('to');
  const ok = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

  const entries = await db.dayEntry.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(halaqaId && !studentId ? { student: { halaqaId } } : {}),
      ...(ok(from) || ok(to)
        ? { day: { ...(ok(from) ? { gte: from! } : {}), ...(ok(to) ? { lte: to! } : {}) } }
        : {}),
    },
    select: {
      studentId: true, day: true, status: true, thobe: true, incomplete: true,
      lines: { select: { kind: true, recited: true, errors: true } },
    },
  });

  const rows = entries as unknown as DayRow[];
  const per = summariseAll(rows);

  return NextResponse.json({
    /** كم يومًا سُجِّل في النظام كلّه — الشاشة تصمت قبل أول حفظ. */
    ever: await db.dayEntry.count(),
    from: ok(from) ? from : null,
    to: ok(to) ? to : null,
    /** حصيلة كل طالب، بمعرّفه. */
    students: Object.fromEntries(per),
    /** وحصيلة المجموع — محسوبة على كل عصر لا كمتوسّط متوسّطات. */
    total: totalFor(rows),
    /** آخر يوم سُجِّل في هذا النطاق، ليقول التقرير إلى متى يمتدّ. */
    lastDay: rows.length
      ? rows.map((r) => r.day).sort().slice(-1)[0]
      : null,
  });
}
