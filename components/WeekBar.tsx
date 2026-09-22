'use client';
/* شريط الأسبوع — السابق، والتالي، والتاريخ نفسه يُضغط.
 *
 * Two arrows alone make last term eleven clicks away. «شريط التاريخ ابيه يكون
 * قابل للضغط وتحديد يوم في الاسبوع ليعرض اسبوع ذلك اليوم» (client, 22 Sep
 * 2026): the label opens the same calendar the rest of the product uses, any
 * day in it is chosen, and the bar lands on the week that day belongs to.
 *
 * White, on purpose — «ويكون الشريط باللون الابيض ليكون واضح». It sits on an
 * off-white card, and the one thing on the card you can act on should stand
 * out from it. Shared by the student's card and the supervisor's register, so
 * the two bars are one bar.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, CalendarDays } from 'lucide-react';
import { MonthGrid } from '@/components/DateField';
import { weekOf, weekDays, weekLabel } from '@/lib/week';
import { asDate, isoDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

export function WeekBar({
  week, isThisWeek, prevWeek, nextWeek, onChange, busy, size = 'md', children,
}: {
  /** The Sunday on screen. */
  week: string;
  isThisWeek: boolean;
  prevWeek: string;
  nextWeek: string | null;
  onChange: (sunday: string) => void;
  busy?: boolean;
  size?: 'sm' | 'md';
  /** A line under the label — the week's tally, where a screen has one. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => asDate(week) ?? new Date());
  const box = useRef<HTMLDivElement>(null);
  const today = isoDate(new Date());

  useEffect(() => { if (open) setCursor(asDate(week) ?? new Date()); }, [open, week]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const shown = new Set(weekDays(week));
  const arrow = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';

  return (
    <div ref={box} className="relative">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-ink-200 bg-white p-1.5 shadow-soft">
        <button onClick={() => onChange(prevWeek)} disabled={busy}
          aria-label="الأسبوع السابق"
          className={cx('grid shrink-0 place-items-center rounded-lg text-ink-600 transition hover:bg-page disabled:opacity-40', arrow)}>
          <ChevronRight size={size === 'sm' ? 15 : 17} />
        </button>

        <div className={cx('min-w-0 flex-1 text-center transition', busy && 'opacity-40')}>
          <button type="button" onClick={() => setOpen((o) => !o)}
            aria-haspopup="dialog" aria-expanded={open} aria-label="اختر يومًا لعرض أسبوعه"
            className={cx('press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-ink-900 transition-colors hover:bg-brand-50',
              size === 'sm' ? 'text-panel' : 'text-base2',
              open && 'bg-brand-50')}>
            <CalendarDays size={size === 'sm' ? 14 : 15} strokeWidth={1.9} className="shrink-0 text-brand-700" />
            {isThisWeek ? <>هذا الأسبوع <span className="text-ink-500">· {weekLabel(week)}</span></> : weekLabel(week)}
          </button>
          {children}
        </div>

        <button onClick={() => nextWeek && onChange(nextWeek)} disabled={busy || !nextWeek}
          aria-label="الأسبوع التالي"
          className={cx('grid shrink-0 place-items-center rounded-lg text-ink-600 transition hover:bg-page disabled:opacity-30', arrow)}>
          <ChevronLeft size={size === 'sm' ? 15 : 17} />
        </button>
      </div>

      {open && (
        <div role="dialog" aria-label="التقويم"
          className="absolute start-1/2 top-[calc(100%+6px)] z-50 w-[19rem] max-w-[calc(100vw-2rem)] translate-x-1/2 rounded-2xl border border-ink-150 bg-paper p-3 shadow-pop">
          <MonthGrid cursor={cursor} setCursor={setCursor} max={today}
            /* The week on screen stays lit, so he sees where he is before he
               moves. */
            isOn={() => false}
            inRange={(iso) => shown.has(iso)}
            onPick={(iso) => { onChange(weekOf(iso)); setOpen(false); }} />
          {!isThisWeek && (
            <button type="button" onClick={() => { onChange(weekOf(today)); setOpen(false); }}
              className="press mt-2 w-full rounded-lg border-t border-ink-150 py-1.5 pt-2 text-panel font-medium text-brand-800">
              هذا الأسبوع
            </button>
          )}
        </div>
      )}
    </div>
  );
}
