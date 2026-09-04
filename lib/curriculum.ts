/* Plan rules — SPEC.md §3.2, §3.3, §4.3, §9(f), and the approved PDF §9 (إد-٥-أ).
   Pure functions. No storage, no React.

   The load-bearing idea is the resolution rule in §3.3: a plan renders as the
   curriculum LEFT JOIN the student's overrides. The curriculum row is never
   written over, so «لا يُفقد الأصل أبدًا» is structural rather than a promise —
   dropping the overrides restores the original because the original never
   moved. */
import type {
  CurriculumDay, ExamDayMap, PlanDayOverride, PlanKind, StudentPlan, Track,
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
  /** True when this row differs from the curriculum — shown in the editor so
      the supervisor can see at a glance what he has changed. */
  overridden: boolean;
};

export type PlanDay = {
  dayNo: number;
  /** An exam day carries a date box instead of ranges (§9). */
  examBadge: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
  rows: PlanRow[];
};

const EMPTY_ROW = { fromSurah: '', fromAyah: '', toSurah: '', toAyah: '', note: '' };

/**
 * Build the sheet a student actually gets.
 *
 * The curriculum supplies the content; the overrides win per (day, kind); the
 * plan supplies how many days there are and where the two badges sit. Days
 * beyond the curriculum are legitimate — «تزيد أيامًا على الأربعة والعشرين» —
 * and simply arrive empty for the supervisor to fill.
 */
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
}): StudentPlan {
  return {
    id: `draft-${args.studentId}-${args.track}-${args.level}`,
    studentId: args.studentId,
    track: args.track,
    level: args.level,
    issuedAt: '',
    issuedBy: '',
    dayCount: DEFAULT_DAY_COUNT,
    examDays: DEFAULT_EXAM_DAYS,
    dailyAmount: args.dailyAmount,
    printedCount: 0,
    createdAt: '',
  };
}

export function resolvePlan(
  plan: Pick<StudentPlan, 'id' | 'track' | 'level' | 'dayCount' | 'examDays'>,
  curriculum: CurriculumDay[],
  overrides: PlanDayOverride[],
): PlanDay[] {
  const base = new Map<string, CurriculumDay>();
  for (const d of curriculum) {
    if (d.track !== plan.track || d.level !== plan.level) continue;
    base.set(`${d.dayNo}:${d.kind}`, d);
  }
  const over = new Map<string, PlanDayOverride>();
  for (const o of overrides) {
    if (o.planId !== plan.id) continue;
    over.set(`${o.dayNo}:${o.kind}`, o);
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
        const key = `${dayNo}:${kind}`;
        const o = over.get(key);
        const b = base.get(key);
        const src = o ?? b ?? EMPTY_ROW;
        return {
          dayNo, kind,
          fromSurah: src.fromSurah, fromAyah: src.fromAyah,
          toSurah: src.toSurah, toAyah: src.toAyah,
          note: src.note,
          overridden: !!o,
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

/* ── Editing — §9, «تعديل الخطة وإضافة السور» ─────────────────────────────── */

/**
 * Adding or removing a day renumbers the rest — «فيعيد النظام ترقيمها من نفسه».
 * The badges ride along: a badge sitting after the removed day shifts down with
 * everything else, or it would end up marking a different day's work.
 */
export function removeDay(
  plan: Pick<StudentPlan, 'dayCount' | 'examDays'>,
  overrides: PlanDayOverride[],
  dayNo: number,
): { dayCount: number; examDays: ExamDayMap; overrides: PlanDayOverride[] } {
  const dayCount = Math.max(1, plan.dayCount - 1);
  const shift = (n: number) => (n > dayNo ? n - 1 : n);
  return {
    dayCount,
    examDays: {
      BADGE_GOLDEN: Math.min(shift(plan.examDays.BADGE_GOLDEN), dayCount),
      BADGE_DIAMOND: Math.min(shift(plan.examDays.BADGE_DIAMOND), dayCount),
    },
    overrides: overrides
      .filter((o) => o.dayNo !== dayNo)
      .map((o) => ({ ...o, dayNo: shift(o.dayNo) })),
  };
}

/** Insert a blank day after `afterDay`, pushing everything below it down. */
export function insertDay(
  plan: Pick<StudentPlan, 'dayCount' | 'examDays'>,
  overrides: PlanDayOverride[],
  afterDay: number,
): { dayCount: number; examDays: ExamDayMap; overrides: PlanDayOverride[] } {
  const shift = (n: number) => (n > afterDay ? n + 1 : n);
  return {
    dayCount: plan.dayCount + 1,
    examDays: {
      BADGE_GOLDEN: shift(plan.examDays.BADGE_GOLDEN),
      BADGE_DIAMOND: shift(plan.examDays.BADGE_DIAMOND),
    },
    overrides: overrides.map((o) => ({ ...o, dayNo: shift(o.dayNo) })),
  };
}

/** True when a row still matches the curriculum — used to drop dead overrides. */
export function matchesCurriculum(
  o: PlanDayOverride, track: Track, level: number, curriculum: CurriculumDay[],
): boolean {
  const b = curriculum.find(
    (d) => d.track === track && d.level === level && d.dayNo === o.dayNo && d.kind === o.kind);
  if (!b) return false;
  return b.fromSurah === o.fromSurah && b.fromAyah === o.fromAyah
    && b.toSurah === o.toSurah && b.toAyah === o.toAyah && b.note === o.note;
}

/** «هل عُدِّلت هذه الورقة عن المنهج؟» — for the badge on the plan screen. */
export const isCustomised = (
  plan: Pick<StudentPlan, 'id' | 'dayCount' | 'examDays'>,
  overrides: PlanDayOverride[],
) => overrides.some((o) => o.planId === plan.id)
  || plan.dayCount !== DEFAULT_DAY_COUNT
  || plan.examDays.BADGE_GOLDEN !== DEFAULT_EXAM_DAYS.BADGE_GOLDEN
  || plan.examDays.BADGE_DIAMOND !== DEFAULT_EXAM_DAYS.BADGE_DIAMOND;
