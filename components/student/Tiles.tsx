'use client';
/* Jewel tiles — a figure worth looking at, not a number in a row.
   The count-up is the only decoration: it makes a static figure feel earned,
   and `prefers-reduced-motion` is honoured globally so it simply does not run
   for anyone who asked for that. */
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';

function useCountUp(to: number, ms = 700) {
  const [n, setN] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) { setN(to); return; }
    if (typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    done.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      /* ease-out: fast to nearly there, then settles — the shape of arriving. */
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return n;
}

export function Tile({ label, value, unit, icon: Icon, accent, delay = 0 }: {
  label: string; value: number; unit?: string; icon: LucideIcon;
  /** A token colour, passed as a CSS variable so the bar and chip agree. */
  accent: string; delay?: number;
}) {
  const n = useCountUp(value);
  return (
    <div className="tile rise overflow-hidden rounded-2xl border border-ink-150 bg-paper p-4 shadow-soft"
      style={{ ['--tile-accent' as string]: accent, animationDelay: `${delay}ms` }}>
      <span className="mb-3 inline-grid h-8 w-8 place-items-center rounded-lg"
        style={{ background: `${accent}1A`, color: accent }}>
        <Icon size={16} strokeWidth={1.9} />
      </span>
      <p className="text-micro text-ink-500">{label}</p>
      <p className="mt-0.5 font-display text-t1 leading-none text-ink-900">
        <Num>{n}</Num>
        {unit && <span className="ms-1 text-base2 font-normal text-ink-500">{unit}</span>}
      </p>
    </div>
  );
}

/** «أنجزت ٪ من مسارك» — and which way the number runs, because it runs DOWN. */
export function ProgressRail({ pct, from, to }: { pct: number; from: number; to: number }) {
  return (
    <div className="rise rounded-2xl border border-ink-150 bg-paper p-5 shadow-soft">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-body font-medium text-ink-900">
          أنجزت <Num className="text-brand-800">{pct}</Num>٪ من مسارك
        </p>
        <p className="text-micro text-ink-500">
          المستوى ينزل من <Num>{from}</Num> إلى <Num>{to}</Num>
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-brand-700 transition-[width] duration-700 ease-brand"
          style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}
