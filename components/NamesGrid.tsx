/* فرسان الأسبوع as a table — «ابي كل اسم كأنه بجدول … الاسم الأول يمين والثاني
   يسار» (client, 11 Oct 2026). Two to a row, each in its own cell, numbered so
   the list reads as complete however long it is: whoever met the rule is on it,
   ten or three or fifteen. */
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';

export function NamesGrid({ names, title, compact }: {
  names: string[];
  /** A heading over the table — the halaqa, on the supervisor's card. */
  title?: string;
  /** Inside a list row (the bell) rather than on an arrival card. */
  compact?: boolean;
}) {
  if (!names.length) return null;
  return (
    <div className={compact ? 'mt-1.5' : 'mt-3'}>
      {title && (
        <p className="mb-1 text-start text-cap font-bold text-brand-800">{title}</p>
      )}
      <ol className="grid grid-cols-2 overflow-hidden rounded-xl border border-ink-150 bg-paper">
        {names.map((n, i) => (
          <li key={`${i}-${n}`}
            className={cx('flex min-w-0 items-center gap-1.5 border-ink-150 text-start text-ink-900',
              compact ? 'px-2 py-1.5 text-xs2' : 'px-2.5 py-2 text-sm2',
              /* Hairlines between cells, none on the outer edge. */
              i % 2 === 0 && 'border-e',
              i >= 2 && 'border-t')}>
            <span className="w-4 shrink-0 text-center text-micro text-warn-700"><Num>{i + 1}</Num></span>
            <span className="min-w-0 break-words font-medium leading-snug">{n}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
