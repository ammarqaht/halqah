/* What the system lets the client change without a redeploy.
   §13.5 fixes today's figures — الفضي ٥٠/١٠٠/٢٠٠ · الذهبي ١٠٠/٢٠٠/٢٠٠ — but
   they are a decision the halaqa made, not a law, and the client asked for
   them where he can reach them. The constants below stay as the DEFAULTS, so a
   fresh database behaves exactly as the approved document says. */
import { EXAM_POINTS } from '@/lib/points';

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
