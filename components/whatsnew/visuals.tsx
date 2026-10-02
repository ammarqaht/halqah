'use client';
/* The hero side of «ما الجديد» — a small moving picture of what changed.

   Drawn, not screenshotted: a screenshot of a table on a green field reads as a
   thumbnail; a drawing of the IDEA reads as an announcement. Each entry in
   content/releases.ts may name one; the rest get the medallion. */
import { useEffect, useState } from 'react';
import { Check, GraduationCap, Layers3, Users, type LucideIcon } from 'lucide-react';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';

const GOLD = '#D9BE83';

/* ── تعديل المستوى: one number changes, and three places follow it ───────── */
function LevelVisual() {
  /* 0 — 60 · 1 — 55 · 2/3/4 — the student, the teacher, the system light up
     in turn · then a breath, and again. */
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const steps = [1600, 900, 650, 650, 2400];
    const t = setTimeout(() => setPhase((p) => (p + 1) % steps.length), steps[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  const level = phase === 0 ? 60 : 55;
  const nodes: { icon: LucideIcon; label: string; at: number }[] = [
    { icon: GraduationCap, label: 'الطالب', at: 2 },
    { icon: Users, label: 'المعلم', at: 3 },
    { icon: Layers3, label: 'النظام', at: 4 },
  ];
  const lit = (at: number) => phase >= at;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-0 px-6">
      {/* the level card */}
      <div className="wn-float relative">
        <div aria-hidden className="wn-glow absolute -inset-6 rounded-[32px] bg-[#D9BE83]/25 blur-2xl" />
        <div className="relative w-[9.5rem] overflow-hidden rounded-[22px] border border-white/15 bg-white/[.07] px-4 pb-4 pt-3 text-center backdrop-blur-sm">
          <p className="text-micro tracking-[.14em] text-white/60">المستوى</p>
          <p key={level} className="wn-pop mt-1 font-display text-[64px] leading-none" style={{ color: GOLD }}>
            <Num>{level}</Num>
          </p>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-micro text-white/55">
            <span className={cx('h-1.5 w-1.5 rounded-full transition-colors duration-500',
              phase >= 1 ? 'bg-[#D9BE83]' : 'bg-white/30')} />
            {phase >= 1 ? 'خطة جديدة' : 'مستواه الآن'}
          </div>
        </div>
      </div>

      {/* the wires */}
      <svg viewBox="0 0 300 70" className="h-[70px] w-full max-w-[20rem]" aria-hidden>
        {[50, 150, 250].map((x, i) => (
          <path key={x} d={`M150 0 C150 35, ${x} 30, ${x} 70`} fill="none"
            stroke={lit(nodes[i].at) ? GOLD : 'rgba(255,255,255,.22)'} strokeWidth="1.6"
            className={cx('transition-[stroke] duration-500', phase >= 1 && 'wn-dash')} />
        ))}
      </svg>

      {/* the three places */}
      <div className="grid w-full max-w-[20rem] grid-cols-3 gap-3">
        {nodes.map(({ icon: I, label, at }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <span className={cx('relative grid h-14 w-14 place-items-center rounded-2xl border transition-all duration-500',
              lit(at) ? 'border-[#D9BE83]/70 bg-[#D9BE83]/15 text-[#E7D3A5] shadow-[0_0_28px_-6px_rgba(217,190,131,.7)]'
                : 'border-white/12 bg-white/[.05] text-white/45')}>
              <I size={22} strokeWidth={1.7} />
              {lit(at) && (
                <span className="wn-pop absolute -bottom-1.5 -left-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#D9BE83] text-brand-900">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className={cx('text-xs2 transition-colors duration-500', lit(at) ? 'text-white' : 'text-white/45')}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── the fallback: the entry's first icon, in a medallion with an orbit ──── */
function Medallion({ icon: I }: { icon: LucideIcon }) {
  return (
    <div className="relative grid h-full w-full place-items-center">
      <div aria-hidden className="wn-orbit absolute h-64 w-64 rounded-full border border-dashed border-white/15" />
      <div aria-hidden className="absolute h-44 w-44 rounded-full border border-white/10" />
      <div aria-hidden className="wn-glow absolute h-40 w-40 rounded-full bg-[#D9BE83]/20 blur-2xl" />
      <span className="wn-float relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-brand-700 to-brand-900 p-1.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,.6)]">
        <span className="grid h-full w-full place-items-center rounded-full text-[#E7D3A5] ring-2 ring-[#D9BE83]/70">
          <I size={42} strokeWidth={1.5} />
        </span>
      </span>
    </div>
  );
}

export function ReleaseVisual({ kind, icon }: { kind?: 'level'; icon: LucideIcon }) {
  if (kind === 'level') return <LevelVisual />;
  return <Medallion icon={icon} />;
}
