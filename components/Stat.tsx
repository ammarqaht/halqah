'use client';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';
import type { LucideIcon } from 'lucide-react';

export function KPI({ label, value, unit, sub, icon: Ico, accent, delay = 0 }:
  { label: string; value: React.ReactNode; unit?: string; sub?: string;
    icon?: LucideIcon; accent?: boolean; delay?: number }) {
  return (
    <div className={cx('rise group relative overflow-hidden rounded-xl border p-5 transition-shadow duration-200 hover:shadow-soft',
      accent ? 'border-brand-200 bg-brand-50' : 'border-ink-150 bg-paper')}
      style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs2 font-medium text-ink-600">{label}</span>
        {Ico && (
          <span className={cx('rounded-md p-1.5 transition-colors',
            accent ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-500 group-hover:bg-brand-100 group-hover:text-brand-800')}>
            <Ico size={15} strokeWidth={1.9} />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={cx('font-display text-d2 leading-none', accent ? 'text-brand-900' : 'text-ink-900')}>
          <Num>{value}</Num>
        </span>
        {unit && <span className="text-xs2 text-ink-500">{unit}</span>}
      </div>
      {sub && <p className="mt-2 text-micro text-ink-500">{sub}</p>}
    </div>
  );
}

/** Proportional split — one bar, segments labelled underneath. */
export function Split({ data, colors }: { data: Record<string, number>; colors: string[] }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const entries = Object.entries(data);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
        {entries.map(([k, v], i) => (
          <div key={k} className={cx('transition-[width] duration-500 ease-brand', colors[i % colors.length])}
            style={{ width: `${(v / total) * 100}%` }} title={`${k}: ${v}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {entries.map(([k, v], i) => (
          <span key={k} className="flex items-center gap-1.5 text-xs2 text-ink-600">
            <span className={cx('h-2 w-2 rounded-full', colors[i % colors.length])} />
            {k}
            <Num className="font-medium text-ink-900">{v}</Num>
          </span>
        ))}
      </div>
    </div>
  );
}
