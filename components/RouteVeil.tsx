'use client';
/* The halaqa mark veils the screen briefly on every section change, then the
   page rises in behind it. Short by design (~560ms): the supervisor navigates
   dozens of times a day, so this is punctuation, not a performance. */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/Logo';
import { cx } from '@/lib/cx';

export function RouteVeil({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const first = useRef(true);
  const [veil, setVeil] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setKey((k) => k + 1); return; }
    setVeil(true);
    const t1 = setTimeout(() => { setVeil(false); setKey((k) => k + 1); }, 380);
    return () => clearTimeout(t1);
  }, [path]);

  return (
    <>
      <div aria-hidden={!veil}
        className={cx('pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-page',
          'transition-opacity duration-[320ms] ease-brand',
          veil ? 'opacity-100' : 'opacity-0')}>
        <div className="relative">
          <span className={cx('absolute -inset-8 rounded-full border border-brand-300',
            veil && 'animate-[ringPulse_.9s_cubic-bezier(.22,.61,.36,1)_both]')} />
          <div className={cx(veil && 'mark-in')}><LogoMark height={44} white={false} /></div>
        </div>
      </div>
      <div key={key} className="rise-flat">{children}</div>
    </>
  );
}
