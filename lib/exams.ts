/* Exam rules — SPEC.md §4.1, §4.2, §4.4, §4.5, §4.8, and the approved PDF §9/§11.
   Pure functions. No storage, no React.

   The boundary with `lib/points.ts`: that module owns §8 — what a thing is
   WORTH. This one owns §9 — how an exam is SCORED and where a student sits in
   his track. `examPoints` therefore stays there and is imported here, so the
   awarding table has exactly one home.

   §11 governs all of it: «النظام يقترح، وأنت تقرّر». Every function below
   computes a suggestion the supervisor can overrule — none of them decides. */
import type { Track } from './types';

/* ── Settings ────────────────────────────────────────────────────────────────
   SPEC.md §3.8 seeds these; until that table exists they live here, and
   nowhere else, so a client decision is one edit rather than a hunt. */

/** §13.4, verbatim: «من ١٠٠: الخطأ درجتان · التنبيه نصف درجة · الخطأ التجويدي درجة». */
export const SCORE_DEDUCTIONS = { error: 2, warning: 0.5, tajweedError: 1 } as const;

/** §13.3: «٨٠ هي أقل درجة ناجحة، وهي الحدّ نفسه لكل أنواع الاختبارات». */
export const PASSING_SCORE = 80;

/**
 * ⚠ The approved PDF says two things about a tajweed exam that cannot both be
 * taken literally:
 *   §9  — «تُسجَّل بدرجة من ١٠ ونقاط تحفيز، كما في ملفكم اليوم».
 *   §11 — «٨٠ من ١٠٠ … وهذا الحدّ واحد لكل أنواع الاختبارات — الجمعية
 *          والوسامان **والتجويد**».
 *
 * Resolved to satisfy both, and flagged in SPEC §9 for the client to confirm:
 * a tajweed exam is ENTERED out of 10, exactly as his own file records it, and
 * judged at the same PROPORTION — 8/10 is the same bar as 80/100. Nothing is
 * silently rescaled and no figure he types changes meaning.
 */
export const scoreMax = (type: string) => (type === 'TAJWEED' ? 10 : 100);

/** The pass mark on that type's own scale: 8 out of 10, or 80 out of 100. */
export const passMarkFor = (type: string) => (PASSING_SCORE / 100) * scoreMax(type);

/** §إد-٥-ج: the on-site sheet opens with this many questions and grows by tap. */
export const DEFAULT_EXAM_QUESTIONS = 5;

/* ── Level progression — §4.1 ───────────────────────────────────────────────── */

/**
 * Both tracks count DOWN: Silver 60→1, Golden 30→1.
 * The system suggests; the supervisor decides — «والنظام يقترحه ولا يفرضه».
 * Never auto-advance a student on the strength of this.
 */
export const nextLevel = (level: number) => Math.max(1, level - 1);

/**
 * §4.2 — the juz-equivalent of a level, exact, from the client's own
 * «قائمة المستويات»: الفضي ٥٩=جزء، ٥٧=جزآن… (كل مستويين جزء) · الذهبي ٣٠=جزء،
 * ٢٩=جزآن… (كل مستوى جزء).
 *
 * A Silver EVEN level sits mid-juz and has no whole-juz value, so it returns
 * `null` rather than a rounded lie — the difference matters, because §4.8 gates
 * association readiness on completing a WHOLE juz.
 */
export function ajzaForLevel(track: Track | null, level: number | null): number | null {
  if (!track || level === null || level < 1) return null;
  if (track === 'GOLDEN') return level <= 30 ? 31 - level : null;
  if (track === 'SILVER') return level % 2 === 1 ? (61 - level) / 2 : null;
  return null;                                   // TALQEEN has no levels at all
}

/** Silver even levels land mid-juz; the screens say so instead of showing «—». */
export const isMidJuz = (track: Track | null, level: number | null) =>
  track === 'SILVER' && level !== null && level % 2 === 0;

/* ── Scoring — §4.4, §4.5 ───────────────────────────────────────────────────── */

export type ErrorCounts = { errors: number; warnings: number; tajweedErrors: number };

/**
 * §4.4 — the score starts at 100 and the counters eat into it.
 * «والخصم ثابت لا يتغيّر باختلاف عدد الأجزاء المختَبرة» — so the number of juz
 * examined deliberately does NOT appear in this function.
 * Clamped to [0, 100]: twelve errors is a zero, not a negative.
 */
export function scoreFromCounters({ errors, warnings, tajweedErrors }: ErrorCounts): number {
  const raw = 100
    - SCORE_DEDUCTIONS.error * (errors || 0)
    - SCORE_DEDUCTIONS.warning * (warnings || 0)
    - SCORE_DEDUCTIONS.tajweedError * (tajweedErrors || 0);
  /* Half-point deductions make thirds of a point impossible but tenths real;
     round to two places so 99.5 stays 99.5 and never becomes 99.49999. */
  return Math.round(Math.max(0, Math.min(100, raw)) * 100) / 100;
}

/** §4.5 — one threshold, applied on each type's own scale. Overridable by hand. */
export const isPassingFor = (type: string, score: number | null) =>
  score !== null && score >= passMarkFor(type);

/** The common case, out of 100. */
export const isPassing = (score: number | null) => isPassingFor('BADGE_GOLDEN', score);

/** Sum the counters on an on-site sheet, one pass, for the live score. */
export const totalCounts = (rows: ErrorCounts[]): ErrorCounts => rows.reduce(
  (a, r) => ({
    errors: a.errors + (r.errors || 0),
    warnings: a.warnings + (r.warnings || 0),
    tajweedErrors: a.tajweedErrors + (r.tajweedErrors || 0),
  }),
  { errors: 0, warnings: 0, tajweedErrors: 0 });

/* ── Readiness for the association exam — §4.8 / §13.6 ──────────────────────── */

/**
 * «شرطان معًا: إتمام الجزء، واجتياز الوسام الماسي عليه. فمن تحقّق فيه الشرطان
 * ولم يُختبر بالجمعية بعد، ظهر في كشف الجاهزين».
 *
 * Both conditions, and the third is implicit in the sentence: not already
 * examined by the association on that same juz.
 */
export function readyForAssociation(args: {
  track: Track | null;
  level: number | null;
  /** Every exam the student has, in any order. */
  exams: { type: string; passed: boolean | null; ajza: number | null }[];
}): { ready: boolean; ajza: number | null; reason: string | null } {
  const { track, level, exams } = args;
  if (!track || track === 'TALQEEN') {
    return { ready: false, ajza: null, reason: 'مسار التلقين خارج الاختبارات المستوياتية' };
  }
  const ajza = ajzaForLevel(track, level);
  if (ajza === null) {
    return { ready: false, ajza: null, reason: 'المستوى لم يُتمّ جزءًا كاملًا بعد' };
  }
  const passedDiamond = exams.some(
    (e) => e.type === 'BADGE_DIAMOND' && e.passed === true && e.ajza === ajza);
  if (!passedDiamond) {
    return { ready: false, ajza, reason: 'لم يجتز الوسام الماسي على هذا الجزء' };
  }
  const alreadyExamined = exams.some(
    (e) => e.type === 'ASSOCIATION' && e.ajza === ajza);
  if (alreadyExamined) {
    return { ready: false, ajza, reason: 'اختبرته الجمعية على هذا الجزء من قبل' };
  }
  return { ready: true, ajza, reason: null };
}

/* ── Which exam is due next — §4.3 ──────────────────────────────────────────── */

/** Day 12 is the golden badge, day 24 the diamond. Both movable per plan. */
export const EXAM_DAYS = { BADGE_GOLDEN: 12, BADGE_DIAMOND: 24 } as const;

/** «اجتاز ٢٦، المفروض أطبع له ٢٥» — what the supervisor is offered after a pass. */
export function suggestionAfter(exam: { type: string; passed: boolean | null }, level: number | null) {
  if (exam.type !== 'BADGE_DIAMOND' || exam.passed !== true || level === null) return null;
  return { printLevel: nextLevel(level) };
}
