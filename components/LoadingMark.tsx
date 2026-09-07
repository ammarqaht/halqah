'use client';
/* The between-screens moment. The mark sits dead centre, the work behind it
   goes soft, and both come back the instant the screen is ready.

   It used to hang from the top edge and leave the page sharp behind it — which
   read as a notification rather than a transition, and left the eye with two
   places to look. Centring it and blurring what is behind gives the eye one
   place to be, and the blur is what makes the return feel like an arrival
   rather than a repaint.

   Everything here is opacity, transform and filter — the three properties a
   browser can animate on the compositor — so a slow screen never stutters the
   animation, and the veil never takes a pointer event. */
import { LogoMark } from '@/components/Logo';
import { cx } from '@/lib/cx';

export function LoadingMark({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden={!show}
      role="status"
      aria-live="polite"
      aria-label={show ? 'جارٍ التحميل' : undefined}
      className={cx(
        'pointer-events-none fixed inset-0 z-[70] grid place-items-center',
        'transition-opacity duration-[380ms] ease-brand',
        show ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* the page, softened — a wash of the paper colour over a real blur, so
          the work stays recognisable underneath instead of being hidden */}
      <div className={cx('absolute inset-0 bg-page/45 transition-[backdrop-filter,opacity] duration-[380ms] ease-brand',
        show ? 'backdrop-blur-[7px] backdrop-saturate-[1.06]' : 'backdrop-blur-0')} />

      {/* one ring of light behind the mark, breathing */}
      <div className={cx('absolute h-[240px] w-[240px] rounded-full',
        'bg-[radial-gradient(circle,rgba(14,141,131,0.13)_0%,rgba(14,141,131,0)_68%)]',
        show && 'animate-[haloBreath_2.4s_ease-in-out_infinite]')} />

      <div className={cx('relative grid h-[92px] w-[92px] place-items-center rounded-full',
        'bg-paper shadow-pop ring-1 ring-ink-150/70',
        'transition-transform duration-[420ms] ease-brand',
        show ? 'scale-100' : 'scale-[0.94]')}>
        {/* the ring: one arc turning at a steady rate, and a second slower arc
            behind it so the motion reads as deliberate rather than busy */}
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 92 92">
          <circle cx="46" cy="46" r="41" fill="none" stroke="#E3E7E1" strokeWidth="2.5" />
          <circle cx="46" cy="46" r="41" fill="none"
            stroke="#0E8D83" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="30 228" strokeOpacity="0.32"
            className={cx(show && 'origin-center animate-[spin_2.6s_linear_infinite]')} />
          <circle cx="46" cy="46" r="41" fill="none"
            stroke="#0E8D83" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="64 194"
            className={cx(show && 'origin-center animate-[spin_1.15s_cubic-bezier(0.6,0,0.4,1)_infinite]')} />
        </svg>
        <LogoMark height={34} white={false}
          className={cx('transition-opacity', show && 'animate-[markPulse_2.4s_ease-in-out_infinite]')} />
      </div>
    </div>
  );
}
