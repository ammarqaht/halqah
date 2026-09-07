/* ─────────────────────────────────────────────────────────────────────────────
   Motion timings — one place, so the brand moment stays consistent and is
   tuned by editing numbers here rather than hunting through components.
   All values in milliseconds. DESIGN.md §5.2.

   The shape: a full-bleed curtain in the page colour holds the mark dead
   centre, then the whole curtain LIFTS out of the top of the viewport,
   revealing the screen that was already rendered underneath it.
   ───────────────────────────────────────────────────────────────────────── */

export const INTRO = {
  fadeIn: 380,   // the mark appears
  hold: 2000,    // and simply sits there — the brand moment
  lift: 780,     // the curtain rises out of view
} as const;

/* Between screens there is no curtain — the mark holds the centre over a blur
   of the work, long enough to read as a transition and short enough never to
   be waited on. The full reveal still belongs to the sign-in alone.

   620 is deliberate: the veil fades in over 380ms, so anything much shorter
   would start fading out before it had finished arriving. */
export const VEIL = {
  /** minimum time the indicator stays up, so a fast navigation doesn't blink */
  minVisible: 620,
} as const;

/** The curtain's easing: slow to release, quick to clear. */
export const LIFT_EASE = 'cubic-bezier(0.7, 0, 0.2, 1)';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
