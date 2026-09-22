import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { isoDate } from '@/lib/dates';
import { weekOf, weekDays, shiftWeek } from '@/lib/week';
import { passagesFor, passageKey, passageLabel } from '@/lib/passage';

/* حضوري وتسميعي — what his teacher wrote about him, read back to him.
 *
 * The teacher's portal has recorded every afternoon since it shipped: present,
 * late or absent; the thobe; which مقرّر was recited and which of its three
 * lines, with the errors on each. None of it reached the boy. He could see his
 * teacher's written NOTES in his alerts and nothing else — so the one person
 * the record is about was the one person it was hidden from.
 *
 * A WEEK AT A TIME, الأحد إلى الخميس. The halaqa's week is five afternoons and
 * the two that are not are not blanks to explain — they are simply not days he
 * was expected. A rolling window of «the last 28 days» said nothing about which
 * week was which; a boy asking «هل غبت الأسبوع الماضي؟» has a week in mind.
 *
 * Nothing here is computed or inferred. A day with no row is «لم يُسجَّل»,
 * never «غائب»: the teacher may simply not have saved yet, and telling a boy he
 * was absent on the system's own authority is the kind of wrong that reaches his
 * father before it reaches us.
 */

/** «حاضر · متأخر · غائب» — §١٥ removed «غائب بعذر» on 18 Sep 2026. */
const STATUS_AR: Record<string, string> = {
  PRESENT: 'حاضر', LATE: 'متأخر', ABSENT: 'غائب',
};

const KIND_AR: Record<string, string> = {
  DARS: 'الدرس', MURAJAA_SUGHRA: 'المراجعة الصغرى', MURAJAA_KUBRA: 'المراجعة الكبرى',
};

/** The order they are recited in and printed in — review before the new. */
const KIND_ORDER = ['MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS'];

export async function GET(req: Request) {
  const g = await scope();
  if (!g.ok) return g.res;

  const today = isoDate(new Date());
  const asked = new URL(req.url).searchParams.get('week');
  /* The Sunday of the week being looked at. An unparseable or future week falls
     back to this one rather than erroring: the screen must always render. */
  const thisWeek = weekOf(today);
  const week = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= thisWeek
    ? weekOf(asked) : thisWeek;

  const days = weekDays(week);              // الأحد … الخميس
  const first = days[0], last = days[days.length - 1];

  const entries = await db.dayEntry.findMany({
    where: { studentId: g.s.sub, day: { gte: first, lte: last } },
    include: { lines: true },
  });
  const byDay = new Map(entries.map((e) => [e.day, e]));
  /* سوره وآياته — فيعرف ما سمّعه لا أنه سمّع فحسب. */
  const passages = await passagesFor(entries);

  const shape = (day: string) => {
    const e = byDay.get(day);
    if (!e) {
      /* «لم يُسجَّل» — and that is all it says. It is not absence. */
      return { day, status: null as null, statusAr: null as string | null,
               future: day > today, lines: [], recitedCount: 0 };
    }
    const lines = [...e.lines]
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
      .map((l) => ({
        kind: l.kind, kindAr: KIND_AR[l.kind] ?? l.kind,
        recited: l.recited, errors: l.errors, note: l.note || null,
        passage: passageLabel(
          passages.get(passageKey(e.track, e.level, e.assignmentNo, l.kind))),
      }));
    return {
      day,
      status: e.status as string,
      statusAr: STATUS_AR[e.status] ?? e.status,
      future: false,
      thobe: e.thobe,
      assignmentNo: e.assignmentNo,
      level: e.level,
      /* «سمّع الدرس دون المراجعة» — he advanced, and the day says so. */
      incomplete: e.incomplete,
      note: e.note || null,
      /* His teacher's name, so a boy knows who wrote it. Never the id. */
      savedBy: e.savedByName || null,
      lines,
      recitedCount: lines.filter((l) => l.recited).length,
      /* مسار التلقين: «آخر سورة قرأها وآخر آية حفظها» — he has no مقرّر, and
         this is the whole of his record. */
      talqeen: e.talqeenSurah ? { surah: e.talqeenSurah, ayah: e.talqeenAyah } : null,
    };
  };

  const rows = days.map(shape);

  /* Counted over what was actually RECORDED, never over the calendar: a day the
     halaqa did not meet, and a day his teacher has not saved, are both simply
     unrecorded — and neither is a mark against him. */
  const recorded = rows.filter((r) => r.status !== null);

  /* Has he anything at all, ever? The card hides itself entirely before the
     first afternoon is saved, and one empty week must not hide a term. */
  const everCount = await db.dayEntry.count({ where: { studentId: g.s.sub } });

  return NextResponse.json({
    today,
    week,
    prevWeek: shiftWeek(week, -1),
    /** null on the current week — there is no next to offer. */
    nextWeek: week < thisWeek ? shiftWeek(week, 1) : null,
    isThisWeek: week === thisWeek,
    days: rows,
    /** ما سجّله لي معلمي اليوم — null حتى يحفظ، لا «غائب». */
    mine: rows.find((r) => r.day === today) ?? null,
    ever: everCount,
    summary: {
      recorded: recorded.length,
      present: recorded.filter((r) => r.status === 'PRESENT').length,
      late: recorded.filter((r) => r.status === 'LATE').length,
      absent: recorded.filter((r) => r.status === 'ABSENT').length,
      /** أيام سمّع فيها شيئًا — وهي غير أيام الحضور. */
      recited: rows.filter((r) => r.recitedCount > 0).length,
    },
  });
}
