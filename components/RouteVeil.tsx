'use client';
/* The halaqa mark veils the screen on every section change, then the page
   fades in behind it. Timings live in lib/motion.ts. The new screen is already
   rendered underneath while the veil is up — nothing waits on the animation. */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/Logo';
import { cx } from '@/lib/cx';
import { VEIL, prefersReducedMotion } from '@/lib/motion';

export function RouteVeil({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const first = useRef(true);
  const [veil, setVeil] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (prefersReducedMotion()) { setKey((k) => k + 1); return; }
    setVeil(true);
    const t = setTimeout(() => { setVeil(false); setKey((k) => k + 1); }, VEIL.hold);
    return () => clearTimeout(t);
  }, [path]);

  return (
    <>
      <div aria-hidden={!veil}
        style={{ transitionDuration: `${VEIL.fadeOut}ms` }}
        className={cx('pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-page',
          'transition-opacity ease-brand', veil ? 'opacity-100' : 'opacity-0')}>
        <div className="relative">
          <span className={cx('absolute -inset-8 rounded-full border border-brand-300',
            veil && 'animate-[ringPulse_1.1s_cubic-bezier(.22,.61,.36,1)_both]')} />
          <div className={cx(veil && 'mark-in')}><LogoMark height={44} white={false} /></div>
        </div>
      </div>
      <div key={key} className="rise-flat">{children}</div>
    </>
  );
}
