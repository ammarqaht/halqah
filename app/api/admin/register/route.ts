import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isoDate } from '@/lib/dates';
import { weekOf, weekDays, shiftWeek } from '@/lib/week';
import { passagesFor, passageKey, passageLabel } from '@/lib/passage';

/* كشف الحضور والتسميع — ما سجّله المعلمون، حلقةً حلقة.
 *
 * Everything the teachers' portal writes has been invisible from this side. The
 * supervisor's screens were built on the imported roster and on what he typed
 * himself; the register — who was present this afternoon, who recited what —
 * lived only in the portal that wrote it. So the one person responsible for
 * seven halaqat could not see what any of them did today.
 *
 * This is that register, by halaqa and by week: the five afternoons الأحد إلى
 * الخميس, each boy's mark on each, and what he recited.
 *
 * It reads. It never writes: التحضير belongs to the teacher who was in the room,
 * and a supervisor correcting it does so through the teacher portal's own
 * screen, where the correction is signed with his name.
 */

const STATUS_AR: Record<string, string> = {
  PRESENT: 'حاضر', LATE: 'متأخر', ABSENT: 'غائب',
};

/** Review before the new, the order it is recited and printed in. */
const KIND_ORDER = ['MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS'];
const KIND_AR: Record<string, string> = {
  DARS: 'الدرس', MURAJAA_SUGHRA: 'المراجعة الصغرى', MURAJAA_KUBRA: 'المراجعة الكبرى',
};

export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const today = isoDate(new Date());
  const thisWeek = weekOf(today);
  const asked = q.get('week');
  const week = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= thisWeek
    ? weekOf(asked) : thisWeek;
  const halaqaId = q.get('halaqa');

  const days = weekDays(week);
  const first = days[0], last = days[days.length - 1];

  const [halaqat, students, entries] = await Promise.all([
    db.halaqa.findMany({
      where: halaqaId ? { id: halaqaId } : {},
      orderBy: { teacher: 'asc' },
      select: { id: true, name: true, teacher: true, timeSlot: true },
    }),
    /* المنقطع لا يظهر في كشف حضور — «ولبس معلوماته تكون موجودة فقط». */
    db.student.findMany({
      where: { status: 'ACTIVE', ...(halaqaId ? { halaqaId } : {}) },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, halaqaId: true, track: true, currentLevel: true },
    }),
    db.dayEntry.findMany({
      where: {
        day: { gte: first, lte: last },
        ...(halaqaId ? { student: { halaqaId } } : {}),
      },
      include: { lines: true },
    }),
  ]);

  /* مقرّر اليوم لمن لم يُسجَّل بعد — مؤشّره حيث وقف. Only for one halaqa:
     it is what the day's window on the dashboard asks «ماذا يسمّع اليوم». */
  const pointers = halaqaId
    ? await db.studentProgress.findMany({
        where: { studentId: { in: students.map((st) => st.id) } },
        select: {
          studentId: true, track: true, level: true, assignmentNo: true,
          awaitingExam: true, talqeenSurah: true, talqeenAyah: true,
        },
      })
    : [];
  const pointerOf = new Map(pointers.map((p) => [p.studentId, p]));

  /* سور كل مقرّر وآياته — استعلام واحد لكل (مسار، مستوى) لمسته البطاقات. */
  const passages = await passagesFor([...entries, ...pointers]);

  /* Keyed by the STUDENT, not the halaqa stamped on the row: a boy who moved
     halaqa mid-term keeps his history where it happened (that is why the column
     is denormalised), but this register is «who is in my halaqa now». */
  const byStudentDay = new Map<string, (typeof entries)[number]>();
  for (const e of entries) byStudentDay.set(`${e.studentId}|${e.day}`, e);

  const rows = halaqat.map((h) => {
    const roster = students.filter((st) => st.halaqaId === h.id);

    const perStudent = roster.map((st) => {
      const cells = days.map((day) => {
        const e = byStudentDay.get(`${st.id}|${day}`);
        if (!e) return { day, status: null as string | null, future: day > today };
        const lines = [...e.lines]
          .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
          .map((l) => ({
            kind: l.kind, kindAr: KIND_AR[l.kind] ?? l.kind,
            recited: l.recited, errors: l.errors, note: l.note || null,
            /* «سمّع الدرس» وحدها لا تقول ماذا سمّع. */
            passage: passageLabel(
              passages.get(passageKey(e.track, e.level, e.assignmentNo, l.kind))),
          }));
        return {
          day, future: false,
          status: e.status as string,
          statusAr: STATUS_AR[e.status] ?? e.status,
          thobe: e.thobe,
          assignmentNo: e.assignmentNo,
          incomplete: e.incomplete,
          talqeen: e.talqeenSurah
            ? `${e.talqeenSurah}${e.talqeenAyah != null ? ` ${e.talqeenAyah}` : ''}` : null,
          note: e.note || null,
          savedBy: e.savedByName || null,
          savedByRole: e.savedByRole,
          lines,
          recited: lines.filter((l) => l.recited).length,
          errors: lines.reduce((n, l) => n + (l.recited ? l.errors : 0), 0),
        };
      });

      const seen = cells.filter((c) => c.status !== null);
      const ptr = pointerOf.get(st.id);
      return {
        id: st.id, fullName: st.fullName,
        track: st.track, level: st.currentLevel,
        cells,
        /* Where his pointer stands now: the مقرّر he is due to recite next. */
        planned: !ptr ? null : {
          assignmentNo: ptr.assignmentNo,
          awaitingExam: ptr.awaitingExam,
          talqeen: ptr.talqeenSurah
            ? `${ptr.talqeenSurah}${ptr.talqeenAyah != null ? ` ${ptr.talqeenAyah}` : ''}` : null,
          lines: KIND_ORDER.map((kind) => ({
            kind, kindAr: KIND_AR[kind],
            passage: passageLabel(passages.get(passageKey(ptr.track, ptr.level, ptr.assignmentNo, kind))),
          })).filter((l) => l.passage),
        },
        present: seen.filter((c) => c.status === 'PRESENT').length,
        late: seen.filter((c) => c.status === 'LATE').length,
        absent: seen.filter((c) => c.status === 'ABSENT').length,
        recitedDays: cells.filter((c) => (c.recited ?? 0) > 0).length,
        errors: cells.reduce((n, c) => n + (c.errors ?? 0), 0),
        /* غاب كل يوم سُجِّل له في هذا الأسبوع — وهو ما يستحق نظر المشرف. */
        allAbsent: seen.length > 0 && seen.every((c) => c.status === 'ABSENT'),
      };
    });

    /* حال كل يوم في الحلقة: كم سُجِّل من أصل الطلاب. «لم يُسجَّل» ليس غيابًا —
       قد يكون المعلم لم يحفظ بعد، وقد لا تكون الحلقة انعقدت. */
    const perDay = days.map((day, i) => {
      const cells = perStudent.map((p) => p.cells[i]);
      const seen = cells.filter((c) => c.status !== null);
      return {
        day,
        future: day > today,
        saved: seen.length,
        roster: roster.length,
        present: seen.filter((c) => c.status === 'PRESENT').length,
        late: seen.filter((c) => c.status === 'LATE').length,
        absent: seen.filter((c) => c.status === 'ABSENT').length,
        recited: cells.filter((c) => (c.recited ?? 0) > 0).length,
        state: seen.length === 0 ? 'NONE'
          : seen.length < roster.length ? 'PARTIAL' : 'FULL',
      };
    });

    return {
      id: h.id, name: h.name, teacher: h.teacher, timeSlot: h.timeSlot,
      roster: roster.length,
      days: perDay,
      students: perStudent,
      /* حصيلة الأسبوع للحلقة كلها. */
      present: perDay.reduce((n, d) => n + d.present, 0),
      late: perDay.reduce((n, d) => n + d.late, 0),
      absent: perDay.reduce((n, d) => n + d.absent, 0),
      recited: perDay.reduce((n, d) => n + d.recited, 0),
      /* كم يومًا من الخمسة لم يُسجَّل فيه شيء — وهذا ما يقال للمشرف لا للمعلم. */
      unsaved: perDay.filter((d) => !d.future && d.state === 'NONE').length,
      absentees: perStudent.filter((p) => p.allAbsent).map((p) => p.fullName),
    };
  });

  return NextResponse.json({
    today, week,
    prevWeek: shiftWeek(week, -1),
    nextWeek: week < thisWeek ? shiftWeek(week, 1) : null,
    isThisWeek: week === thisWeek,
    days,
    halaqat: rows,
    /* هل كُتب شيء في النظام أصلًا؟ الشاشة تختفي قبل أول حفظ بدل أن تعرض أصفارًا
       تُقرأ غيابًا جماعيًا. */
    ever: await db.dayEntry.count(),
  });
}
