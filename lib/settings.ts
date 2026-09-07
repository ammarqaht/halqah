/* What the system lets the client change without a redeploy.
   §13.5 fixes today's figures — الفضي ٥٠/١٠٠/٢٠٠ · الذهبي ١٠٠/٢٠٠/٢٠٠ — but
   they are a decision the halaqa made, not a law, and the client asked for
   them where he can reach them. The constants below stay as the DEFAULTS, so a
   fresh database behaves exactly as the approved document says. */
import { EXAM_POINTS } from '@/lib/points';
import { POINT_REASONS, CODE_PURPOSES } from '@/lib/types';

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
