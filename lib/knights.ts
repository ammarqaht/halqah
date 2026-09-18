import 'server-only';
import { db } from '@/lib/db';
import { knightOfWeek, type KnightDay } from '@/lib/teacher';
import { isoDate } from '@/lib/dates';
import { TRACK_AR, type PlanKind, type Track } from '@/lib/types';

/* ─────────────────────────────────────────────────────────────────────────────
   فرسان الأسبوع — «من حقّقوا كل المتطلبات اليوم لمدة أسبوع: الحضور، والثوب،
   والتسميع كامل» (client, 18 Sep 2026).

   Read in ONE place because two surfaces print it: the teacher's own halaqa
   (`/api/teacher/reports?kind=KNIGHTS`) and the supervisor's sheet across the
   mosque (`/api/admin/knights`). Two resolvers would be two definitions of a
   title children are named by, and they would drift the first time either was
   touched.

   The RULE itself is in `lib/teacher.ts` and tested there. This file only
   fetches the rows and hands them to it.
   ───────────────────────────────────────────────────────────────────────── */

/** Seven days, ending on the day asked for. */
export const WEEK_DAYS = 7;

export const weekFrom = (to: string) =>
  isoDate(new Date(Date.parse(`${to}T00:00:00`) - (WEEK_DAYS - 1) * 86_400_000));

export type KnightRow = {
  id: string;
  fullName: string;
  halaqaId: string | null;
  halaqaName: string;
  trackAr: string;
  level: number | null;
  /** Days met, and halaqa days in the window — «٥ من ٥». */
  met: number;
  of: number;
};

export type KnightsResult = {
  from: string;
  to: string;
  /** Every halaqa day counted, across the halaqat asked for. */
  days: string[];
  rows: KnightRow[];
  /** Everyone who was looked at — so an empty sheet can say whether the week
      had no halaqa in it or simply no فارس. */
  considered: number;
};

/**
 * Who was a فارس in the week ending `to`.
 *
 * `halaqaId` narrows it to one halaqa; omitted, it reads the whole mosque and
 * each halaqa is judged on ITS OWN registered days — a halaqa that met four
 * times must not cost its boys a title because another met five.
 */
export async function knightsOfWeek(
  { to, halaqaId }: { to: string; halaqaId?: string | null },
): Promise<KnightsResult> {
  const from = weekFrom(to);

  const students = await db.student.findMany({
    where: { status: 'ACTIVE', ...(halaqaId ? { halaqaId } : {}) },
    orderBy: { fullName: 'asc' },
    include: { progress: true },
  });
  const ids = students.map((s) => s.id);
  if (!ids.length) return { from, to, days: [], rows: [], considered: 0 };

  const [entries, exams, halaqat] = await Promise.all([
    db.dayEntry.findMany({
      where: { studentId: { in: ids }, day: { gte: from, lte: to } },
      include: { lines: true },
    }),
    /* «واللي عنده اختبار إذا اختبر واجتاز يُحسب ذلك اليوم أنه حقّق المتطلب لذلك
       اليوم» (client, 18 Sep 2026) — so an exam day is read as well as a halaqa
       day, and only a PASSED one counts. */
    db.exam.findMany({
      where: { studentId: { in: ids }, takenOn: { gte: from, lte: to }, passed: true },
      select: { studentId: true, takenOn: true },
    }),
    db.halaqa.findMany({ select: { id: true, name: true, teacher: true } }),
  ]);

  const halaqaName = new Map(halaqat.map((h) => [h.id, h.name || h.teacher]));

  /* «أيّ يوم فيه تحضير يُعتبر يوم حلقة» (client, 17 Sep 2026) — so the week's
     halaqa days are the days the halaqa was REGISTERED on, not the days its
     weekday setting says it opens. A day nobody registered is not a day a boy
     failed to attend, and a halaqa that met exceptionally on a Saturday counts
     that Saturday. */
  const daysOf = new Map<string, Set<string>>();
  const byStudent = new Map<string, Record<string, KnightDay>>();
  for (const e of entries) {
    const h = e.halaqaId ?? '—';
    const set = daysOf.get(h) ?? new Set<string>();
    set.add(e.day);
    daysOf.set(h, set);

    const mine = byStudent.get(e.studentId) ?? {};
    mine[e.day] = {
      status: e.status,
      thobe: e.thobe,
      lines: e.lines.map((l) => ({
        kind: l.kind as PlanKind, recited: l.recited, errors: l.errors })),
    };
    byStudent.set(e.studentId, mine);
  }

  const passedOn = new Map<string, Record<string, boolean>>();
  for (const e of exams) {
    const mine = passedOn.get(e.studentId) ?? {};
    mine[e.takenOn] = true;
    passedOn.set(e.studentId, mine);
  }

  const rows: KnightRow[] = [];
  for (const s of students) {
    const days = [...(daysOf.get(s.halaqaId ?? '—') ?? [])].sort();
    const v = knightOfWeek(days, byStudent.get(s.id) ?? {}, passedOn.get(s.id) ?? {});
    if (!v.knight) continue;
    const track = s.track as Track | null;
    rows.push({
      id: s.id,
      fullName: s.fullName,
      halaqaId: s.halaqaId,
      halaqaName: halaqaName.get(s.halaqaId ?? '') ?? '—',
      trackAr: track ? TRACK_AR[track] : '—',
      level: s.progress?.level ?? s.currentLevel ?? null,
      met: v.met,
      of: v.of,
    });
  }

  /* Named, not ranked: they are equals, and the sheet says so by its order. */
  rows.sort((a, b) => a.halaqaName.localeCompare(b.halaqaName, 'ar')
    || a.fullName.localeCompare(b.fullName, 'ar'));

  const all = new Set<string>();
  for (const set of daysOf.values()) for (const d of set) all.add(d);

  return { from, to, days: [...all].sort(), rows, considered: students.length };
}
