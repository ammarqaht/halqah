/* ─────────────────────────────────────────────────────────────────────────────
   Motion timings — one place, so the brand moment stays consistent and is
   tuned by editing numbers here rather than hunting through components.
   All values in milliseconds. DESIGN.md §5.2.
   ───────────────────────────────────────────────────────────────────────── */

export const INTRO = {
  /** the mark fades in at the centre of an empty ground */
  fadeIn: 420,
  /** it then simply sits there — this is the brand moment */
  hold: 2000,
  /** travel to its resting place while the panel wipes in behind it */
  travel: 620,
  /** the form fades up slightly behind the travel, so the two overlap */
  formDelay: 180,
} as const;

/** t = 0 … INTRO.hold … INTRO.hold + INTRO.travel */
export const INTRO_TOTAL = INTRO.hold + INTRO.travel;

export const VEIL = {
  /** the mark is on screen and readable for this long between screens */
  hold: 620,
  /** then the veil dissolves and the new screen is already behind it */
  fadeOut: 380,
} as const;

export const VEIL_TOTAL = VEIL.hold + VEIL.fadeOut;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
