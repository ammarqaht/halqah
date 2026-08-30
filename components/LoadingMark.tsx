'use client';
/* The between-screens indicator: the halaqa mark with a ring turning around it.
   Small, fixed, and non-blocking — the screen underneath stays visible and
   readable. A full-bleed curtain belongs to arrival (the sign-in), not to the
   dozens of navigations a supervisor makes in a working afternoon. */
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
        'pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center pt-6',
        'transition-opacity duration-200 ease-brand',
        show ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="relative grid h-[68px] w-[68px] place-items-center rounded-full bg-paper shadow-soft">
        {/* the ring: a single arc turning at a steady rate */}
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r="30" fill="none" stroke="#E3E7E1" strokeWidth="2.5" />
          <circle
            cx="34" cy="34" r="30" fill="none"
            stroke="#0E8D83" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="47 141"
            className={cx(show && 'origin-center animate-[spin_1.05s_linear_infinite]')}
          />
        </svg>
        <LogoMark height={26} white={false} />
      </div>
    </div>
  );
}
