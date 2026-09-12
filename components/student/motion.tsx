'use client';
/* The two pieces of motion the portal reuses, in one place so there is one
   implementation of each rather than one per screen.

   `prefers-reduced-motion` is checked in JS as well as in the global CSS rule,
   because a count-up is a state change and not an animation — CSS cannot reach
   it, and a boy who asked for stillness should be handed the finished figure. */
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/cx';

const still = () => typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A figure that arrives. Counts once on mount and then tracks its value
 * exactly, so a redeemed card moves 200 → 300 rather than restarting at zero.
 */
export function useCountUp(to: number, ms = 700) {
  const [n, setN] = useState(() => (still() ? to : 0));
  const from = useRef(0);

  useEffect(() => {
    if (still()) { setN(to); from.current = to; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      /* ease-out: fast to nearly there, then settles — the shape of arriving. */
      setN(Math.round(a + (to - a) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);

  return n;
}

/**
 * Apple Fitness's shape, for Apple Fitness's reason: one glance says how far
 * along, with the figure it belongs to sitting inside the ring instead of
 * beside it. It replaced four separate stat boxes on الرئيسية.
 *
 * `tone` is a Tailwind `stroke-*` class — the ring is drawn in a token like
 * everything else, not a hex the config has never heard of.
 */
export function Ring({ size, stroke, pct, tone, track = 'stroke-ink-100', children }: {
  size: number; stroke: number; pct: number;
  tone: string; track?: string; children?: React.ReactNode;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (still()) { setFilled(true); return; }
    const t = setTimeout(() => setFilled(true), 60);
    return () => clearTimeout(t);
  }, []);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = filled ? Math.max(0, Math.min(100, pct)) : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          strokeWidth={stroke} className={track} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={(c * (1 - shown / 100)).toFixed(1)}
          className={cx(tone, 'transition-[stroke-dashoffset] duration-[1100ms] ease-brand')} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
