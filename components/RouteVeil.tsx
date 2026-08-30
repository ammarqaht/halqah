'use client';
/* Navigation feedback. The mark with a turning ring, fixed at the top centre —
   present and in the same place every time, and never covering the work. */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LoadingMark } from '@/components/LoadingMark';
import { VEIL, prefersReducedMotion } from '@/lib/motion';

export function RouteVeil({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const first = useRef(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (prefersReducedMotion()) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), VEIL.minVisible);
    return () => clearTimeout(t);
  }, [path]);

  return (
    <>
      <LoadingMark show={loading} />
      {children}
    </>
  );
}
