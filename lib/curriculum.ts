/* Plan rules — SPEC.md §3.2, §3.3, §4.3, §9(f), and the approved PDF §9 (إد-٥-أ).
   Pure functions. No storage, no React.

   The load-bearing idea in §3.3: a plan renders as the level's curriculum, and
   nothing else. There is no per-student layer over it — a level's sheet is one
   sheet for everyone who takes it, edited in one place. So there is only ever
   one answer to «ما مقرَّر اليوم الثالث؟», and no way for two students on the
   same level to hold different papers. */
import type {
  CurriculumDay, ExamDayMap, PlanKind, StudentPlan, Track,
} from './types';
import { PLAN_KIND_ORDER } from './types';

/* ── Defaults ────────────────────────────────────────────────────────────── */

/** §4.3 — «٢٤ يوم عمل» per level, and the two badge days inside it. */
export const DEFAULT_DAY_COUNT = 24;
export const DEFAULT_EXAM_DAYS: ExamDayMap = { BADGE_GOLDEN: 12, BADGE_DIAMOND: 24 };

/**
 * §1 of the glossary: «الفضي … نصف صفحة/يوم» و«الذهبي … صفحة/يوم».
 * Printed in the sheet's header, and overridable per student.
 */
export const dailyAmountFor = (track: Track): string =>
  track === 'GOLDEN' ? 'وجه' : track === 'SILVER' ? 'نصف وجه' : '—';

/* ── The tajweed footer — §5.4 ─────────────────────────────────────────────
   «مرجع التجويد المطبوع أسفل الخطة». Part of the printed sheet, not decoration:
   the student reads it while he waits his turn. Seeded here because it is fixed
   reference text, not data the supervisor maintains. */
export const TAJWEED_FOOTER = [
  { title: 'الإظهار', body: 'ء · هـ · ع · ح · غ · خ' },
  { title: 'الإدغام', body: 'ي · ر · م · ل · و · ن' },
  { title: 'الإقلاب', body: 'ب' },
  { title: 'الإخفاء', body: 'ما بقي من الحروف' },
  { title: 'القلقلة', body: 'ق · ط · ب · ج · د' },
  { title: 'الغنّة', body: 'ن · م — المشدَّدتان' },
] as const;

/* ── Resolution — §3.3 ───────────────────────────────────────────────────── */

export type PlanRow = {
  dayNo: number;
  kind: PlanKind;
  fromSurah: string;
  fromAyah: string;
  toSurah: string;
  toAyah: string;
  note: string;
};

export type PlanDay = {
  dayNo: number;
  /** An exam day carries a date box instead of ranges (§9). */
  examBadge: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
  rows: PlanRow[];
};

const EMPTY_ROW = { fromSurah: '', fromAyah: '', toSurah: '', toAyah: '', note: '' };

/**
 * How many working days a level actually runs to.
 *
 * The level's own curriculum is the authority — it is the only place a day can
 * be added or removed now — so a level extended to 26 days hands out 26. A
 * level with nothing uploaded falls back to the §4.3 default rather than to
 * zero, which would print a sheet with no days on it at all.
 */
export function dayCountFor(
  track: Track, level: number, curriculum: CurriculumDay[],
): number {
  const days = curriculum
    .filter((d) => d.track === track && d.level === level)
    .map((d) => d.dayNo);
  return days.length ? Math.max(...days) : DEFAULT_DAY_COUNT;
}

/**
 * A plan to LOOK at, built in memory and stored nowhere.
 *
 * Previewing must not write. The screen used to call `store.issuePlan` while
 * rendering, so opening a student's sheet created a plan row and overwrote his
 * level with whatever level happened to be on screen. This is what a preview
 * needs — the same shape, with the defaults §9 fixes — and printing is still
 * what commits it.
 */
export function draftPlan(args: {
  studentId: string; track: Exclude<Track, null>; level: number; dailyAmount: string;
  dayCount?: number;
}): StudentPlan {
  return {
    id: `draft-${args.studentId}-${args.track}-${args.level}`,
    studentId: args.studentId,
    track: args.track,
    level: args.level,
    issuedAt: '',
    issuedBy: '',
    dayCount: args.dayCount ?? DEFAULT_DAY_COUNT,
    examDays: DEFAULT_EXAM_DAYS,
    dailyAmount: args.dailyAmount,
    printedCount: 0,
    createdAt: '',
  };
}

/**
 * Build the sheet a student actually gets.
 *
 * The level's curriculum supplies every line; the plan supplies how many days
 * there are and where the two badges sit. Days the curriculum does not reach
 * arrive empty rather than missing, so a gap prints as a blank row the
 * supervisor can see — and the editor names those days before it comes to that.
 */
export function resolvePlan(
  plan: Pick<StudentPlan, 'track' | 'level' | 'dayCount' | 'examDays'>,
  curriculum: CurriculumDay[],
): PlanDay[] {
  const base = new Map<string, CurriculumDay>();
  for (const d of curriculum) {
    if (d.track !== plan.track || d.level !== plan.level) continue;
    base.set(`${d.dayNo}:${d.kind}`, d);
  }

  const days: PlanDay[] = [];
  for (let dayNo = 1; dayNo <= plan.dayCount; dayNo++) {
    const examBadge =
      dayNo === plan.examDays.BADGE_GOLDEN ? 'BADGE_GOLDEN' as const
      : dayNo === plan.examDays.BADGE_DIAMOND ? 'BADGE_DIAMOND' as const
      : null;

    /* An exam day has no recitation rows at all — «لا بمقرّر حفظ». */
    if (examBadge) { days.push({ dayNo, examBadge, rows: [] }); continue; }

    days.push({
      dayNo,
      examBadge: null,
      rows: PLAN_KIND_ORDER.map((kind) => {
        const src = base.get(`${dayNo}:${kind}`) ?? EMPTY_ROW;
        return {
          dayNo, kind,
          fromSurah: src.fromSurah, fromAyah: src.fromAyah,
          toSurah: src.toSurah, toAyah: src.toAyah,
          note: src.note,
        };
      }),
    });
  }
  return days;
}

/* ── What the curriculum can and cannot answer — §9(f) ────────────────────── */

export type LevelAvailability =
  | { ok: true; days: number }
  | { ok: false; reason: string };

/**
 * «الفضي ٣٩→١ غير موجودة في ملف العميل، والعميل يقبل الثغرة» — but a missing
 * level must fail loudly and by name, never as a blank sheet handed to a child.
 */
export function levelAvailable(
  track: Track, level: number, curriculum: CurriculumDay[],
): LevelAvailability {
  const rows = curriculum.filter((d) => d.track === track && d.level === level);
  if (rows.length === 0) {
    const trackAr = track === 'GOLDEN' ? 'الذهبي' : 'الفضي';
    /* Naming the range that IS there turns «غير موجود» from a dead end into an
       instruction: the client's own «منهج الحفظ» carries silver 40–60 only, and
       without saying so the message reads like a fault in the system. */
    const have = [...new Set(curriculum.filter((d) => d.track === track).map((d) => d.level))]
      .sort((a, b) => a - b);
    const span = have.length === 0 ? 'ولا مستوى واحد من هذا المسار مرفوع بعد.'
      : `المرفوع من هذا المسار: المستويات ${have[0]}–${have[have.length - 1]}`
        + `${have.length === have[have.length - 1] - have[0] + 1 ? '' : ' (بفجوات)'}.`;
    return {
      ok: false,
      reason: `المستوى ${level} في المسار ${trackAr} غير موجود في ملف المنهج المرفوع. ${span} `
        + 'ارفع الصفحات الناقصة من «منهج الحفظ» ثم أعد المحاولة — لن تُطبع ورقة فارغة.',
    };
  }
  const days = new Set(rows.map((r) => r.dayNo)).size;
  return { ok: true, days };
}

/** Which levels the uploaded curriculum actually covers, per track. */
export function coverage(curriculum: CurriculumDay[]) {
  const byTrack = new Map<Track, Set<number>>();
  for (const d of curriculum) {
    if (!byTrack.has(d.track)) byTrack.set(d.track, new Set());
    byTrack.get(d.track)!.add(d.level);
  }
  return [...byTrack.entries()].map(([track, set]) => {
    const levels = [...set].sort((a, b) => b - a);
    return { track, levels, count: levels.length, max: levels[0], min: levels[levels.length - 1] };
  });
}

/**
 * The days of a level that are not filled in.
 *
 * A day is incomplete when any of its three lines has no «من سورة» — that is
 * the one field a line cannot be read without, and the client's own uploaded
 * sheets have gaps in exactly that shape. A level printed with a gap hands a
 * student a blank row, so the editor names the days rather than waiting for the
 * paper to say it.
 */
export function incompleteDays(
  days: CurriculumDay[], dayCount: number,
): { day: number; missing: PlanKind[] }[] {
  const out: { day: number; missing: PlanKind[] }[] = [];
  for (let day = 1; day <= dayCount; day++) {
    const missing = PLAN_KIND_ORDER.filter((kind) => {
      const row = days.find((d) => d.dayNo === day && d.kind === kind);
      return !row || !String(row.fromSurah ?? '').trim();
    });
    if (missing.length) out.push({ day, missing });
  }
  return out;
}

/* Editing lives at the level and nowhere else — §9, «تعديل الخطة وإضافة
   السور». Days are added and removed by editing that level's curriculum, so
   there is deliberately no per-plan removeDay/insertDay here: a day inserted
   for one student and not another is exactly the divergence this design
   removed. `dayCountFor` above is how a plan learns the new length. */
