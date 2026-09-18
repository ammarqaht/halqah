/* ─────────────────────────────────────────────────────────────────────────────
   حسبة الأوجه — كم وجهًا يحفظ الطالب ويراجع في يومه.

   From the client's own «مسارات الحفظ» sheet (18 Sep 2026):

     الذهبي — ٣٠ مستوى، كل مستوى جزء كامل
       درس جديد    : وجه كامل
       مراجعة صغرى : آخر ثلاثة دروس
       مراجعة كبرى : من الجزء ١-١٠ ← ١٠ أوجه · ١١-٢٠ ← ١٥ · ٢١-٣٠ ← ٢٠

     الفضي — ٦٠ مستوى، كل مستوى حزب كامل
       درس جديد    : نصف وجه
       مراجعة صغرى : آخر درسين
       مراجعة كبرى : من الجزء ١-٥ ← ٥ أوجه · ٦-١٥ ← ١٠ · ١٦-٣٠ ← ١٥

   THE RULE IS DATA, NOT CODE. It lives in the `settings` table under
   `memorisation_pages` and is read from there — «تكون مربوطة بقاعدة البيانات»
   (client). What is here is the shape it must have and the default it was
   seeded with, so a figure is changed with one row rather than a deployment.

   AND IT IS NOT PRINTED ANYWHERE. «ما يحتاج تذكر تفاصيلها للعلن»: the screens
   show the totals it produces — «إجمالي أوجه الحفظ» و«إجمالي أوجه المراجعة» —
   and never the bands behind them.

   THE SMALL REVIEW IS STATED AS THE SHEET STATES IT: «آخر ثلاث دروس», not «٣
   أوجه». They are the same number today only because a golden lesson is one
   page; on the silver track two lessons are one page, and a rule that stored
   the answer rather than the sentence would have been wrong there.
   ───────────────────────────────────────────────────────────────────────── */
import type { Track } from './types';

/** One band of the big review: up to this juz, that many pages a day. */
export type KubraBand = { upToJuz: number; pages: number };

export type TrackPages = {
  /** الدرس الجديد — وجه كامل للذهبي، نصف وجه للفضي. */
  lesson: number;
  /** المراجعة الصغرى — كم درسًا من التي مضت. */
  sughraLessons: number;
  /** المراجعة الكبرى — تزيد كلما تقدّم في المصحف. */
  kubra: KubraBand[];
};

export type PagesRule = { GOLDEN: TrackPages; SILVER: TrackPages };

export const DEFAULT_PAGES: PagesRule = {
  GOLDEN: {
    lesson: 1,
    sughraLessons: 3,
    kubra: [{ upToJuz: 10, pages: 10 }, { upToJuz: 20, pages: 15 }, { upToJuz: 30, pages: 20 }],
  },
  SILVER: {
    lesson: 0.5,
    sughraLessons: 2,
    kubra: [{ upToJuz: 5, pages: 5 }, { upToJuz: 15, pages: 10 }, { upToJuz: 30, pages: 15 }],
  },
};

/**
 * أيّ جزء هو فيه الآن — من مستواه.
 *
 * Both tracks count DOWN: golden 30→1 at a juz each, silver 60→1 at a hizb
 * each. So a golden boy on level 30 is in juz 1 and on level 1 in juz 30; a
 * silver boy on 60 and 59 is in juz 1, on 58 and 57 in juz 2.
 *
 * `null` when there is no level to read it from — and null is not one: a boy
 * with no level recorded must not be counted as if he were on the first.
 */
export function juzOfLevel(track: Track | null, level: number | null): number | null {
  if (level == null || !Number.isFinite(level) || level < 1) return null;
  if (track === 'GOLDEN') return Math.min(30, Math.max(1, 31 - level));
  if (track === 'SILVER') return Math.min(30, Math.max(1, Math.ceil((61 - level) / 2)));
  return null;                       // التلقين خارج المسارين، فلا أوجه له
}

const bandFor = (bands: KubraBand[], juz: number) =>
  bands.find((b) => juz <= b.upToJuz)?.pages ?? bands[bands.length - 1]?.pages ?? 0;

/**
 * كم وجهًا يقع على كل مقرّر من مقرّرات يومه.
 *
 * Returns zeros for a talqeen boy and for anyone whose level is unknown: the
 * figures are added up across a halaqa, and a guess would be indistinguishable
 * from a fact once summed.
 */
export function pagesFor(
  track: Track | null,
  level: number | null,
  rule: PagesRule = DEFAULT_PAGES,
): { dars: number; sughra: number; kubra: number } {
  const zero = { dars: 0, sughra: 0, kubra: 0 };
  if (track !== 'GOLDEN' && track !== 'SILVER') return zero;
  const juz = juzOfLevel(track, level);
  if (juz == null) return zero;
  const t = rule[track];
  return {
    dars: t.lesson,
    sughra: t.lesson * t.sughraLessons,
    kubra: bandFor(t.kubra, juz),
  };
}

/** A stored value read back, with every missing piece filled from the default
    and every number forced to something a page count can be. */
export function readPages(raw: unknown): PagesRule {
  const v = (raw ?? {}) as Partial<Record<keyof PagesRule, unknown>>;
  const num = (x: unknown, fallback: number) => {
    const n = Number(x);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const one = (src: unknown, fallback: TrackPages): TrackPages => {
    const o = (src ?? {}) as Partial<Record<keyof TrackPages, unknown>>;
    const bands = Array.isArray(o.kubra) && o.kubra.length
      ? (o.kubra as unknown[]).map((b, i) => {
          const r = (b ?? {}) as { upToJuz?: unknown; pages?: unknown };
          const f = fallback.kubra[Math.min(i, fallback.kubra.length - 1)];
          return { upToJuz: num(r.upToJuz, f.upToJuz), pages: num(r.pages, f.pages) };
        }).sort((a, b) => a.upToJuz - b.upToJuz)
      : fallback.kubra;
    return {
      lesson: num(o.lesson, fallback.lesson),
      sughraLessons: num(o.sughraLessons, fallback.sughraLessons),
      kubra: bands,
    };
  };
  return {
    GOLDEN: one(v.GOLDEN, DEFAULT_PAGES.GOLDEN),
    SILVER: one(v.SILVER, DEFAULT_PAGES.SILVER),
  };
}
