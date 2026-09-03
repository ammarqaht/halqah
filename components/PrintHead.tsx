'use client';
/* The shared head of every printed report — DESIGN.md §8: both logos (mosque
   right, association left), the display-family title, and the rule underneath.
   `assoc` switches the rule to the association's blue: DESIGN.md §1.3 reserves
   `assoc.*` for records that leave the mosque, and a report addressed to the
   association is exactly that. */
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits } from '@/components/Num';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

export function PrintHead({ title, sub, assoc }:
  { title: string; sub?: React.ReactNode; assoc?: boolean }) {
  return (
    <header className={cx('keep mb-4 flex items-center justify-between gap-4 border-b-2 pb-3',
      assoc ? 'border-assoc-300' : 'border-brand-700')}>
      <LogoMark height={38} white={false} />
      <div className="text-center">
        <h1 className="font-display text-h2 text-ink-900">{title}</h1>
        {sub && (
          <p className={cx('mt-0.5 text-xs2', assoc ? 'font-medium text-assoc-700' : 'text-ink-600')}>
            {sub}
          </p>
        )}
      </div>
      <LogoJamiyah height={38} />
    </header>
  );
}

/** The print-date line every report closes with. */
export function PrintFoot({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="keep mt-6 flex items-center justify-between border-t border-ink-150 pt-2 text-micro text-ink-500">
      <span>{children}</span>
      <span>تاريخ الطباعة: <Num>{toArabicDigits(formatDate(new Date().toISOString()))}</Num></span>
    </footer>
  );
}

/** Section label inside a report — the brand hairline start-border. */
export function PrintSec({ children, assoc }: { children: React.ReactNode; assoc?: boolean }) {
  return (
    <h2 className={cx('mb-1.5 mt-4 border-s-[3px] ps-2 text-sm2 font-bold text-ink-900',
      assoc ? 'border-assoc-300' : 'border-brand-700')}>
      {children}
    </h2>
  );
}

/** One bordered cell, the same look as the plan sheet's tables. */
export const PCELL = 'border border-ink-300 px-1.5 py-1 text-center align-middle';
