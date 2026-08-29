'use client';
/* The halaqa mark veils the screen on every section change, then the page
   fades in behind it. Timings live in lib/motion.ts. The new screen is already
   rendered underneath while the veil is up — nothing waits on the animation. */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Curtain } from '@/components/Curtain';
import { VEIL, prefersReducedMotion } from '@/lib/motion';

export function RouteVeil({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const first = useRef(true);
  const [markVisible, setMarkVisible] = useState(false);
  const [up, setUp] = useState(false);
  const [show, setShow] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (prefersReducedMotion()) { setKey((k) => k + 1); return; }

    setShow(true); setUp(false); setMarkVisible(false);
    const t0 = setTimeout(() => setMarkVisible(true), 20);
    const t1 = setTimeout(() => { setUp(true); setKey((k) => k + 1); }, VEIL.hold);
    const t2 = setTimeout(() => setShow(false), VEIL.hold + VEIL.lift);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [path]);

  return (
    <>
      {show && (
        <Curtain up={up} markVisible={markVisible}
                 fadeIn={VEIL.fadeIn} lift={VEIL.lift} height={64} />
      )}
      <div key={key}>{children}</div>
    </>
  );
}
