'use client';
import { cx } from '@/lib/cx';

export function Sheet({ children, className, pad = true }:
  { children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-ink-150 bg-paper shadow-card',
      pad && 'p-6', className)}>{children}</section>
  );
}

export function SheetHead({ title, meta, action }:
  { title: string; meta?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg2 font-bold text-ink-900">{title}</h2>
        {meta && <p className="mt-1 text-xs2 text-ink-500">{meta}</p>}
      </div>
      {action}
    </div>
  );
}
