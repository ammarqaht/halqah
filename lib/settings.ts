/* What the system lets the client change without a redeploy.
   §13.5 fixes today's figures — الفضي ٥٠/١٠٠/٢٠٠ · الذهبي ١٠٠/٢٠٠/٢٠٠ — but
   they are a decision the halaqa made, not a law, and the client asked for
   them where he can reach them. The constants below stay as the DEFAULTS, so a
   fresh database behaves exactly as the approved document says. */
import { EXAM_POINTS } from '@/lib/points';
import { POINT_REASONS, CODE_PURPOSES } from '@/lib/types';
import {
  DEFAULT_DAILY_POINTS, DEFAULT_GOLDEN_POINTS, DEFAULT_HALAQA_WEEKDAYS,
  type DailyPointItems,
} from '@/lib/teacher';

export type PointsSettings = {
  SILVER: { BADGE_GOLDEN: number; BADGE_DIAMOND: number; ASSOCIATION: number };
  GOLDEN: { BADGE_GOLDEN: number; BADGE_DIAMOND: number; ASSOCIATION: number };
};

export const POINTS_KEY = 'exam_points';

export const DEFAULT_POINTS: PointsSettings = {
  SILVER: { ...EXAM_POINTS.SILVER } as PointsSettings['SILVER'],
  GOLDEN: { ...EXAM_POINTS.GOLDEN } as PointsSettings['GOLDEN'],
};

/** Reads a stored value back, filling any field the row does not carry. */
export function readPoints(raw: unknown): PointsSettings {
  const v = (raw ?? {}) as Partial<PointsSettings>;
  return {
    SILVER: { ...DEFAULT_POINTS.SILVER, ...(v.SILVER ?? {}) },
    GOLDEN: { ...DEFAULT_POINTS.GOLDEN, ...(v.GOLDEN ?? {}) },
  };
}

export const isDefaultPoints = (p: PointsSettings) =>
  JSON.stringify(p) === JSON.stringify(DEFAULT_POINTS);


/* ── The lists behind the two dropdowns ──────────────────────────────────────
   «بنود النقاط» — what a manual grant is FOR, and what a printed card is for.
   §8 dictates today's, and they are the defaults; the halaqa runs a competition
   or starts a new activity and the list has to grow with it, so they are the
   client's to edit.

   Both are stored as plain arrays of strings, which is what they are on screen
   and what every existing row already holds — an id would have bought nothing
   and broken every transaction ever written. Renaming a band therefore does NOT
   rewrite history: rows keep the wording they were written with. */

export const REASONS_KEY = 'point_reasons';
export const PURPOSES_KEY = 'code_purposes';

export const DEFAULT_REASONS: string[] = [...POINT_REASONS];
export const DEFAULT_PURPOSES: string[] = [...CODE_PURPOSES];

/** Trims, drops blanks, and removes duplicates — keeping the first spelling. */
export function readList(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const t = String(v ?? '').replace(/\s+/g, ' ').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t); out.push(t);
  }
  return out.length ? out : fallback;
}


/* ── بنود النقاط اليومية — §١٣ ────────────────────────────────────────────────
   «وهذه البنود تُضاف إلى النظام لأول مرة، وتكون قابلة للتعديل من إعدادات النقاط
   كما بنود الاختبارات اليوم».

   The values are the client's own paper — حضور ١٠ · ثوب ٢ · الدرس ٥ · م.ص ٢ ·
   م.ك ٥ — and they are the DEFAULTS here for the same reason the badge figures
   are: a fresh database behaves exactly as the approved document says, and the
   setting is an override rather than a second source of truth.

   They need to be reachable more than the badge figures do. Twenty-four points
   a day is roughly five hundred a month for a regular student, while a silver
   الوسام الذهبي is fifty — so two afternoons of attendance are worth a badge,
   and the store's prices were set before any of this existed. That is a
   conversation to have with the supervisor, and it should cost him an edit. */

export const DAILY_POINTS_KEY = 'daily_points';

export type DailyPointsSettings = {
  /** المسار الفضي. */
  items: DailyPointItems;
  /** المسار الذهبي — five figures of its own, not a factor over the silver.
      Stored as a table since 18 Sep 2026; `readDaily` migrates the older
      `{ lines, attendance }` multiplier into one. */
  golden: DailyPointItems;
};

export const DEFAULT_DAILY: DailyPointsSettings = {
  items: { ...DEFAULT_DAILY_POINTS },
  golden: { ...DEFAULT_GOLDEN_POINTS },
};

/** A stored value read back, with every missing field filled from the defaults
    and every present one forced to a sane integer. A negative daily item would
    make attendance cost a student points, which no screen offers and no rule
    describes — so it is refused here rather than trusted. */
export function readDaily(raw: unknown): DailyPointsSettings {
  const v = (raw ?? {}) as { items?: unknown; golden?: unknown };
  const n = (x: unknown, fallback: number) => {
    const i = Math.trunc(Number(x));
    return Number.isFinite(i) && i >= 0 ? i : fallback;
  };
  const table = (src: unknown, fallback: DailyPointItems) => {
    const o = (src ?? {}) as Record<string, unknown>;
    const out = { ...fallback };
    for (const k of Object.keys(out) as (keyof DailyPointItems)[]) out[k] = n(o[k], fallback[k]);
    return out;
  };

  const items = table(v.items, DEFAULT_DAILY.items);

  /* MIGRATION. Until 18 Sep 2026 the golden track was stored as a pair of
     multipliers, `{ lines, attendance }`. A database written then must keep
     paying exactly what it paid, so an old value is read as what it MEANT —
     the silver table at those factors — rather than discarded for the default. */
  const g = (v.golden ?? {}) as Record<string, unknown>;
  const legacy = 'lines' in g || 'attendance' in g;
  const golden = legacy
    ? {
        ATTENDANCE: items.ATTENDANCE * Math.max(1, n(g.attendance, 1)),
        THOBE: items.THOBE * Math.max(1, n(g.attendance, 1)),
        DARS: items.DARS * Math.max(1, n(g.lines, 1)),
        MURAJAA_SUGHRA: items.MURAJAA_SUGHRA * Math.max(1, n(g.lines, 1)),
        MURAJAA_KUBRA: items.MURAJAA_KUBRA * Math.max(1, n(g.lines, 1)),
      }
    : table(v.golden, DEFAULT_DAILY.golden);

  return { items, golden };
}

export const isDefaultDaily = (d: DailyPointsSettings) =>
  JSON.stringify(d) === JSON.stringify(DEFAULT_DAILY);


/* ── وثيقة المتطلبات الأولى تقول غير هذا ──────────────────────────────────────
   `weekly_sheet_points` was seeded from the FIRST requirements document
   (SPEC.md §3.8) long before the teacher's portal, and it is a different table:

              حضور   ثوب   درس    م.ص   م.ك    اليوم الكامل
     الأول   فضي  ١٠    ١٠   ٢.٥    ٢.٥   ٥      ٣٠
             ذهبي  ٢٠    ١٠   ٥      ٥     ١٠     ٥٠
     الثالث  فضي  ١٠    ٢    ٥      ٢     ٥      ٢٤

   Three of the five figures disagree, and the first document also ANSWERS the
   question the third leaves open: its golden attendance doubles (١٠ → ٢٠) while
   its thobe does not (١٠ in both). One of the two documents mis-transcribed the
   client's paper, and no amount of reading either settles which.

   So §١٣ ships as the default — it is the newest and the one the client handed
   us — and the older table is offered beside it on the settings card as one tap,
   with both totals shown. That is a decision for the supervisor to make while
   looking at the two numbers, not one to bury in a constant.

   And it must be whole numbers: `point_txns.delta` is an integer because a
   balance is the sum of its rows (§٣.٥), so ٢.٥ cannot be awarded. Reading the
   first table therefore FLOORS the halves, which is stated on the card rather
   than done quietly — if the client truly means half points, the fix is doubling
   every figure in the system, not rounding one of them. */

export const WEEKLY_SHEET_KEY = 'weekly_sheet_points';

export type WeeklySheetPoints = {
  SILVER: { attendance: number; thobe: number; dars: number; ms: number; mk: number };
  GOLDEN: { attendance: number; thobe: number; dars: number; ms: number; mk: number };
};

/** The first document's table, as `daily_points` would express it. Golden is a
    MULTIPLIER here, so it is derived from the two columns rather than assumed —
    and when the columns are not a clean multiple of each other the silver column
    wins and the multiplier is reported as the closest whole ratio on the lines. */
export function dailyFromWeeklySheet(raw: unknown): DailyPointsSettings | null {
  const v = raw as Partial<WeeklySheetPoints> | null | undefined;
  const s = v?.SILVER;
  const g = v?.GOLDEN;
  if (!s || !g) return null;
  const n = (x: unknown) => {
    const i = Math.trunc(Number(x));
    return Number.isFinite(i) && i >= 0 ? i : 0;
  };
  const ratio = (a: unknown, b: unknown) => {
    const top = Number(a), bottom = Number(b);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return 1;
    return Math.max(1, Math.round(top / bottom));
  };
  return {
    items: {
      ATTENDANCE: n(s.attendance), THOBE: n(s.thobe),
      DARS: n(s.dars), MURAJAA_SUGHRA: n(s.ms), MURAJAA_KUBRA: n(s.mk),
    },
    /* The first document names the golden figures outright, so they are read
       rather than derived — which is the whole point of the golden column now. */
    golden: {
      ATTENDANCE: n(g.attendance), THOBE: n(g.thobe),
      DARS: n(g.dars), MURAJAA_SUGHRA: n(g.ms), MURAJAA_KUBRA: n(g.mk),
    },
  };
}


/* ── أيام انعقاد الحلقة ───────────────────────────────────────────────────────
   «أيّ يوم يكون فيه تحضير يُعتبر يوم حلقة، الأصل من الأحد إلى الخميس، لكن ممكن
   يضاف يوم استثنائي أو ينقص يوم» — the client, 17 Sep 2026.

   So this setting is NOT a gate. It says which days OPEN THEMSELVES, and
   nothing more: a Friday on which a halaqa is held is opened by hand from the
   day card and counts exactly the same once it is, and a Tuesday nobody
   registered simply is not a halaqa day. That is why there is no holidays list
   here and no holidays table in the schema — «سجل الحضور هو التقويم».

   Stored per halaqa as well as globally, because «فقد تختلف حلقة عن أخرى»: the
   value is `{ default: number[], byHalaqa: { [id]: number[] } }`, and a halaqa
   with no entry of its own follows the default. */

/**
 * حسبة الأوجه — «مسارات الحفظ» كما في ورقة العميل.
 *
 * The shape, the default and the reader live in `lib/pages.ts`; this is only
 * the row it is stored under. It is data on purpose — «تكون مربوطة بقاعدة
 * البيانات» (client, 18 Sep 2026) — so a figure changes with one row rather
 * than a deployment, and no screen prints the bands themselves.
 */
export const PAGES_KEY = 'memorisation_pages';

export const WEEKDAYS_KEY = 'halaqa_weekdays';

export type WeekdaysSettings = {
  default: number[];
  byHalaqa: Record<string, number[]>;
};

export const DEFAULT_WEEKDAYS: WeekdaysSettings = {
  default: [...DEFAULT_HALAQA_WEEKDAYS],
  byHalaqa: {},
};

/** 0–6, unique, ascending. Anything else in the row is noise, not a weekday. */
function cleanDays(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback;
  const out = [...new Set(raw.map((v) => Math.trunc(Number(v)))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6))].sort((a, b) => a - b);
  /* An empty list would mean a halaqa no day ever opens for, and the teacher
     would face a card that never offers him his own afternoon. */
  return out.length ? out : fallback;
}

export function readWeekdays(raw: unknown): WeekdaysSettings {
  const v = (raw ?? {}) as Partial<WeekdaysSettings>;
  const def = cleanDays(v.default, DEFAULT_WEEKDAYS.default);
  const byHalaqa: Record<string, number[]> = {};
  for (const [id, days] of Object.entries(v.byHalaqa ?? {})) {
    byHalaqa[id] = cleanDays(days, def);
  }
  return { default: def, byHalaqa };
}

/** Which days open themselves for one halaqa. */
export const weekdaysFor = (s: WeekdaysSettings, halaqaId: string | null | undefined) =>
  (halaqaId && s.byHalaqa[halaqaId]) || s.default;
