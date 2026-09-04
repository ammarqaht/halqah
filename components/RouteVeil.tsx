'use client';
/* Navigation feedback. The mark holds the centre while the work behind it goes
   soft, and both settle back the moment the screen is ready — present, in the
   same place every time, and never taking a click. */
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
