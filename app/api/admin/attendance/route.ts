import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { summariseAll, totalFor, type DayRow } from '@/lib/attendance';
import { passagesFor, passageKey, passageLabel } from '@/lib/passage';
import { PLAN_KIND_AR, PLAN_KIND_ORDER } from '@/lib/types';

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
      studentId: true, day: true, status: true, thobe: true, incomplete: true, note: true,
      track: true, level: true, assignmentNo: true, talqeenSurah: true, talqeenAyah: true,
      lines: { select: { kind: true, recited: true, errors: true } },
    },
  });

  const rows = entries as unknown as DayRow[];
  const per = summariseAll(rows);

  /* «آخر درس» — where the lesson line last reached: the latest afternoon he
     recited his الدرس, read as the surah and ayah it ENDS on. A talqeen boy
     has no lesson line; where his teacher left him is his last lesson. Only
     for a halaqa or one boy — the whole mosque's history is not a report. */
  const lastLesson: Record<string, { day: string; surah: string; ayah: string }> = {};
  if (halaqaId || studentId) {
    const latest = new Map<string, typeof entries[number]>();
    for (const e of entries) {
      const lesson = e.talqeenSurah
        || e.lines.some((l) => l.kind === 'DARS' && l.recited);
      if (!lesson) continue;
      const prev = latest.get(e.studentId);
      if (!prev || prev.day < e.day) latest.set(e.studentId, e);
    }
    const passages = await passagesFor([...latest.values()]);
    for (const [sid, e] of latest) {
      if (e.talqeenSurah) {
        lastLesson[sid] = { day: e.day, surah: e.talqeenSurah, ayah: e.talqeenAyah != null ? String(e.talqeenAyah) : '' };
        continue;
      }
      const p = passages.get(passageKey(e.track, e.level, e.assignmentNo, 'DARS'));
      const surah = p?.toSurah || p?.fromSurah;
      if (surah) lastLesson[sid] = { day: e.day, surah, ayah: p?.toAyah || p?.fromAyah || '' };
    }
  }

  /* «تفصيل بحضوره وش الأيام الي حضرها ووش سمع فيها» (client, 10 Oct 2026) —
     for ONE boy, every afternoon his teacher recorded: the status, the ثوب,
     and each of the three lines with whether it was recited, its errors and
     the passage it was, newest first. Only for a single student: it is a
     page of his file, not a register of the mosque. */
  let days: unknown[] | undefined;
  if (studentId) {
    const passages = await passagesFor(entries);
    days = [...entries].sort((a, b) => (a.day < b.day ? 1 : -1)).map((e) => ({
      day: e.day, status: e.status, thobe: e.thobe, incomplete: e.incomplete, note: e.note,
      level: e.level, assignmentNo: e.assignmentNo,
      talqeen: e.talqeenSurah
        ? { surah: e.talqeenSurah, ayah: e.talqeenAyah != null ? String(e.talqeenAyah) : '' } : null,
      lines: PLAN_KIND_ORDER.map((kind) => {
        const l = e.lines.find((x) => x.kind === kind);
        return {
          kind, kindAr: PLAN_KIND_AR[kind],
          recited: !!l?.recited, errors: l?.errors ?? 0,
          passage: passageLabel(passages.get(passageKey(e.track, e.level, e.assignmentNo, kind))),
        };
      }),
    }));
  }

  return NextResponse.json({
    /** يوم بيوم — لطالب واحد فقط (انظر أعلاه). */
    ...(days ? { days } : {}),
    /** كم يومًا سُجِّل في النظام كلّه — الشاشة تصمت قبل أول حفظ. */
    ever: await db.dayEntry.count(),
    from: ok(from) ? from : null,
    to: ok(to) ? to : null,
    /** حصيلة كل طالب، بمعرّفه. */
    students: Object.fromEntries(per),
    /** آخر درس سمّعه كل طالب — السورة وآخر آية. */
    lastLesson,
    /** وحصيلة المجموع — محسوبة على كل عصر لا كمتوسّط متوسّطات. */
    total: totalFor(rows),
    /** آخر يوم سُجِّل في هذا النطاق، ليقول التقرير إلى متى يمتدّ. */
    lastDay: rows.length
      ? rows.map((r) => r.day).sort().slice(-1)[0]
      : null,
  });
}
