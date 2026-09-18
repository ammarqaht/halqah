import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { knightOfWeek, type KnightDay } from '@/lib/teacher';
import { weekFrom } from '@/lib/knights';
import { isoDate } from '@/lib/dates';
import { TRACK_AR, type PlanKind, type Track } from '@/lib/types';

/* تقرير تسجيل معلم — «بطريقة عرضية، فيه أسماء الطلاب في صفوف والأيام في أعمدة،
   وفيها ٤ خانات لكل من الثوب والدرس والمراجعتين، والحضور أو التأخير يُعلَّم يومه
   بلون الحالة أخضر أو أصفر، والغائب يُسجَّل يومه بـ«-»، وتكون بيانات لأسبوع واحد،
   وآخر عمود خانة فارس» (client, 18 Sep 2026).

   It is the week of one halaqa on one page: what the teacher wrote down, laid
   out the way he would have written it on paper — which is the point. A
   supervisor holding it can see in one glance who came, who wore his thobe, who
   recited what, and who finished the week whole.

   THE DAYS ARE THE REGISTERED ONES, not the halaqa's weekday setting. «أيّ يوم
   فيه تحضير يُعتبر يوم حلقة» (client, 17 Sep 2026), and the same rule the فرسان
   sheet counts by — so an exceptional Saturday gets a column and a Sunday nobody
   opened does not.

   And the فارس column is `knightOfWeek` itself, not a second opinion about it:
   one definition of a title children are named by.

   WHO THE ROW IS, before what he did in it: «أضف عمود المسار والمستوى وأي مقرّر
   وصل له» (client, 18 Sep 2026). A tick under الدرس means nothing on its own —
   a supervisor reading the sheet is asking whether a boy on المستوى الثالث at
   مقرّر ١٢ recited what ١٢ actually is, and without those three columns he has
   to hold a hundred and seventeen pointers in his head to read one page. */

export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const url = new URL(req.url);
  const today = isoDate(new Date());
  const to = (url.searchParams.get('to') || today).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'تاريخ غير صحيح.' }, { status: 400 });
  }
  const from = weekFrom(to);
  const halaqaId = url.searchParams.get('halaqa') || null;

  const halaqa = halaqaId
    ? await db.halaqa.findUnique({
        where: { id: halaqaId },
        select: { id: true, name: true, teacher: true, timeSlot: true, mosque: true } })
    : null;
  if (halaqaId && !halaqa) {
    return NextResponse.json({ error: 'لم يُعثر على الحلقة.' }, { status: 404 });
  }

  const students = await db.student.findMany({
    where: { status: 'ACTIVE', ...(halaqaId ? { halaqaId } : {}) },
    orderBy: { fullName: 'asc' },
    include: { progress: true, plans: { orderBy: { issuedAt: 'desc' }, take: 1 } },
  });
  const ids = students.map((x) => x.id);
  if (!ids.length) {
    return NextResponse.json({
      from, to, today,
      halaqa: halaqa ? { name: halaqa.name || halaqa.teacher, teacher: halaqa.teacher,
        timeSlot: halaqa.timeSlot } : null,
      days: [], rows: [],
    });
  }

  const [entries, exams] = await Promise.all([
    db.dayEntry.findMany({
      where: { studentId: { in: ids }, day: { gte: from, lte: to } },
      include: { lines: true },
      orderBy: { day: 'asc' },
    }),
    db.exam.findMany({
      where: { studentId: { in: ids }, takenOn: { gte: from, lte: to }, passed: true },
      select: { studentId: true, takenOn: true },
    }),
  ]);

  /* The columns: every day this halaqa actually registered, in order. */
  const days = [...new Set(entries.map((e) => e.day))].sort();

  type Entry = (typeof entries)[number];
  const byStudent = new Map<string, Map<string, Entry>>();
  for (const e of entries) {
    const mine: Map<string, Entry> = byStudent.get(e.studentId) ?? new Map();
    mine.set(e.day, e);
    byStudent.set(e.studentId, mine);
  }
  const passedOn = new Map<string, Record<string, boolean>>();
  for (const e of exams) {
    const mine = passedOn.get(e.studentId) ?? {};
    mine[e.takenOn] = true;
    passedOn.set(e.studentId, mine);
  }

  const rows = students.map((st) => {
    const mine: Map<string, Entry> = byStudent.get(st.id) ?? new Map();
    const forRule: Record<string, KnightDay> = {};
    for (const [day, e] of mine) {
      forRule[day] = {
        status: e.status, thobe: e.thobe,
        lines: e.lines.map((l) => ({
          kind: l.kind as PlanKind, recited: l.recited, errors: l.errors })),
      };
    }
    const v = knightOfWeek(days, forRule, passedOn.get(st.id) ?? {});

    /* The pointer first, then the plan he was issued, then the level on his
       own record: the same order `lib/day.ts` resolves them in, so the sheet
       cannot disagree with the card his teacher was looking at. */
    const plan = st.plans[0] ?? null;
    const track = (st.track as Track | null) ?? null;
    const level = st.progress?.level ?? plan?.level ?? st.currentLevel ?? null;

    return {
      id: st.id,
      fullName: st.fullName,
      trackAr: track ? TRACK_AR[track] : null,
      /* تلقين has no level and no مقرّر at all — «لا مستوى له ولا منهج» — and
         the sheet says so with a dash rather than with a nought. */
      level: track === 'TALQEEN' ? null : level,
      assignmentNo: track === 'TALQEEN' ? null : (st.progress?.assignmentNo ?? null),
      /* One cell per day: the four marks, and the status that colours it. */
      cells: days.map((day) => {
        const e = mine.get(day);
        if (!e) {
          /* Nothing written — not an absence. «ويومٌ لم يُسجَّل فيه أحد ليس يوم
             حلقة أصلًا», and for one boy it is a day his teacher did not reach. */
          return { day, status: null as string | null, thobe: false,
            dars: false, sughra: false, kubra: false, exam: !!passedOn.get(st.id)?.[day] };
        }
        const on = (k: PlanKind) => e.lines.some((l) => l.kind === k && l.recited);
        return {
          day,
          status: e.status,
          thobe: e.thobe,
          dars: on('DARS'),
          sughra: on('MURAJAA_SUGHRA'),
          kubra: on('MURAJAA_KUBRA'),
          exam: !!passedOn.get(st.id)?.[day],
        };
      }),
      knight: v.knight,
      met: v.met,
      of: v.of,
    };
  });

  return NextResponse.json({
    from, to, today,
    halaqa: halaqa
      ? { name: halaqa.name || halaqa.teacher, teacher: halaqa.teacher, timeSlot: halaqa.timeSlot }
      : null,
    days,
    rows,
  });
}
