import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isoDate } from '@/lib/dates';
import { PAGES_KEY } from '@/lib/settings';
import { pagesFor, readPages } from '@/lib/pages';
import { type Track } from '@/lib/types';

/* تقدّم الحلقات — اليوم وحده.
   «في تقدّم الحلقات في رئيسية المشرف أبيك تعرض إحصائيات اليوم فقط، ولا تعرض
   متوسطات بل إجمالي، وإحصائيات الفترة تكون في التقارير» (client, 18 Sep 2026).

   The table under that heading came from the last رتل file: a term's totals and
   their per-student averages, on the screen the supervisor opens every
   afternoon to ask what is happening TODAY. Two different questions were
   sharing a heading, and the one being asked at four o'clock was the one not
   being answered.

   So the home screen reads the day: who came, who was late, who was heard —
   from what the teachers have actually registered in the last hour. The term's
   figures moved to التقارير, where a period is a thing you choose.

   COUNTS, NEVER AVERAGES. «ولا تعرض متوسطات بل إجمالي»: an average over a
   halaqa of four and a halaqa of twenty-five is the one number that compares
   them, and it is also the one number nobody acts on at four o'clock. */

export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const url = new URL(req.url);
  const day = (url.searchParams.get('day') || isoDate(new Date())).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: 'تاريخ غير صحيح.' }, { status: 400 });
  }

  /* حسبة الأوجه من قاعدة البيانات، لا من الشيفرة. */
  const rule = readPages(
    (await db.setting.findUnique({ where: { key: PAGES_KEY } }))?.value);

  const [halaqat, students, entries] = await Promise.all([
    db.halaqa.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, teacher: true, timeSlot: true },
    }),
    db.student.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, halaqaId: true, track: true, currentLevel: true },
    }),
    db.dayEntry.findMany({
      where: { day },
      /* `level` comes off the ENTRY: it is the level he was on when the day
         was saved, and the big review is measured from where he stands. */
      include: { lines: { select: { kind: true, recited: true } } },
    }),
  ]);

  const halaqaOf = new Map(students.map((x) => [x.id, x.halaqaId]));
  const size = new Map<string, number>();
  for (const x of students) {
    if (x.halaqaId) size.set(x.halaqaId, (size.get(x.halaqaId) ?? 0) + 1);
  }

  /* المسارات في كل حلقة — the column the old table carried, unchanged: it
     describes the halaqa rather than the day, and it is how a supervisor reads
     the row beside it. */
  const tracks = new Map<string, Record<string, number>>();
  for (const x of students) {
    if (!x.halaqaId || !x.track) continue;
    const m = tracks.get(x.halaqaId) ?? {};
    m[x.track] = (m[x.track] ?? 0) + 1;
    tracks.set(x.halaqaId, m);
  }

  type Row = {
    id: string; name: string; teacher: string; timeSlot: string;
    students: number; tracks: Record<string, number>;
    present: number; late: number; absent: number;
    dars: number; murajaa: number; recited: number; thobe: number; recorded: number;
    /** إجمالي أوجه الحفظ وأوجه المراجعة اليوم — من حسبة «مسارات الحفظ». */
    hifzPages: number; reviewPages: number;
  };
  const rows = new Map<string, Row>(halaqat.map((h) => [h.id, {
    id: h.id, name: h.name || h.teacher, teacher: h.teacher, timeSlot: h.timeSlot,
    students: size.get(h.id) ?? 0, tracks: tracks.get(h.id) ?? {},
    present: 0, late: 0, absent: 0,
    dars: 0, murajaa: 0, recited: 0, thobe: 0, recorded: 0,
    hifzPages: 0, reviewPages: 0,
  }]));

  const trackOf = new Map(students.map((x) => [x.id, (x.track as Track | null) ?? null]));
  /* His level as the roster has it, used only when the day itself did not
     record one — an older entry, saved before the level travelled with it. */
  const levelOf = new Map(students.map((x) => [x.id, x.currentLevel]));

  for (const e of entries) {
    const hid = halaqaOf.get(e.studentId);
    const r = hid ? rows.get(hid) : null;
    if (!r) continue;                      // a boy who has left the roster
    r.recorded += 1;
    if (e.status === 'PRESENT') r.present += 1;
    else if (e.status === 'LATE') r.late += 1;
    else if (e.status === 'ABSENT') r.absent += 1;
    if (e.thobe) r.thobe += 1;
    /* الدرس والمراجعة — عددُ من سمّعهما اليوم.
       رتل's «أوجه الحفظ» and «أوجه المراجعة» are PAGES over a term, and the
       teacher's registration records no pages at all: it records who recited
       what this afternoon. So these are the day's own two figures, counted by
       student — and named for what they are rather than borrowing a word that
       would make them look like pages. */
    if (e.lines.some((l) => l.kind === 'DARS' && l.recited)) r.dars += 1;
    if (e.lines.some((l) => l.kind !== 'DARS' && l.recited)) r.murajaa += 1;

    /* والأوجه — ما حُفظ فعلًا وما رُوجع فعلًا.
       Counted from the LINES that were recited, never from the roster: a boy
       who was there and did not recite adds nothing, which is the whole point
       of a figure the supervisor reads at four o'clock. */
    const p = pagesFor(trackOf.get(e.studentId) ?? null, e.level ?? levelOf.get(e.studentId) ?? null, rule);
    for (const l of e.lines) {
      if (!l.recited) continue;
      if (l.kind === 'DARS') r.hifzPages += p.dars;
      else if (l.kind === 'MURAJAA_SUGHRA') r.reviewPages += p.sughra;
      else if (l.kind === 'MURAJAA_KUBRA') r.reviewPages += p.kubra;
    }
    /* «سمّع» — the same line the teacher's own screen counts by: at least one
       مقرّر heard. Two systems counting one word differently is how a
       supervisor ends up telephoning about a figure nobody disagrees with. */
    if (e.lines.some((l) => l.recited)) r.recited += 1;
  }

  const list = [...rows.values()].map((r) => ({
    ...r,
    /* A boy nobody has recorded yet is NOT absent. Today is still running, and
       an empty afternoon must not read as twenty-five absences. */
    unrecorded: Math.max(0, r.students - r.recorded),
  }));

  const sum = (f: (r: (typeof list)[number]) => number) => list.reduce((n, r) => n + f(r), 0);

  return NextResponse.json({
    day,
    halaqat: list,
    totals: {
      students: sum((r) => r.students),
      hifzPages: sum((r) => r.hifzPages),
      reviewPages: sum((r) => r.reviewPages),
      dars: sum((r) => r.dars),
      murajaa: sum((r) => r.murajaa),
      present: sum((r) => r.present),
      late: sum((r) => r.late),
      absent: sum((r) => r.absent),
      recited: sum((r) => r.recited),
      thobe: sum((r) => r.thobe),
      recorded: sum((r) => r.recorded),
      unrecorded: sum((r) => r.unrecorded),
      /** How many halaqat have opened the day at all. */
      openedHalaqat: list.filter((r) => r.recorded > 0).length,
    },
  });
}
