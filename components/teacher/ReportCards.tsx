'use client';
/* التقارير على الشاشة — بطاقة لكل طالب، لا جدولًا في ورقة A4.
 *
 * Every one of these reports was a 794px-wide sheet opened in a new tab with a
 * print button on it. A teacher holds a phone 390px across, standing between
 * twenty-five boys: an A4 table there is a horizontal scrollbar and type he
 * cannot read, and every report he opened told him — correctly — that he was
 * looking at a piece of paper.
 *
 * So the same data, arranged for the thumb: one card per student, the figures
 * as labelled pills rather than columns, and the one number that matters made
 * big enough to read at arm's length. Paper is still one tap away — the sheets
 * are unchanged and still print — but it is no longer the only way to look.
 *
 * WHAT A CARD SHOWS IS NOT A SHRUNKEN TABLE. A column that is «—» on every row
 * costs nothing on paper and a line of noise on a phone, so a pill appears only
 * when it has something to say. And the row is ordered by what the teacher acts
 * on: whoever is flagged, absent or stuck comes first.
 */
import { Num, toArabicDigits } from '@/components/Num';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

/** رقم وعنوانه — الوحدة التي تُبنى منها البطاقة. */
export function Stat({
  label, value, tone = 'ink', big = false,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'ink' | 'brand' | 'warn' | 'risk' | 'ok';
  big?: boolean;
}) {
  const colour = {
    ink: 'text-ink-800', brand: 'text-brand-800', ok: 'text-brand-800',
    warn: 'text-warn-700', risk: 'text-risk-700',
  }[tone];
  return (
    <div className="min-w-0">
      <span className="block text-micro leading-tight text-ink-500">{label}</span>
      <span className={cx('block leading-tight tabular-nums',
        big ? 'font-display text-t2' : 'text-base2 font-medium', colour)}>
        {value}
      </span>
    </div>
  );
}

/** بطاقة طالب: اسمه، وشارة إن وُجدت، ثم أرقامه. */
export function StudentCard({
  name, badge, tone, stats, children, sub,
}: {
  name: string;
  badge?: React.ReactNode;
  /** يلوّن الحافّة حين يحتاج الطالب تدخّلًا. */
  tone?: 'risk' | 'warn' | 'ok';
  sub?: React.ReactNode;
  stats?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className={cx('rounded-2xl border bg-paper p-4 shadow-soft',
      tone === 'risk' ? 'border-risk-200'
        : tone === 'warn' ? 'border-warn-200'
        : tone === 'ok' ? 'border-brand-200'
        : 'border-ink-150')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base2 font-medium text-ink-900">{name}</p>
          {sub && <p className="mt-0.5 text-xs2 text-ink-500">{sub}</p>}
        </div>
        {badge}
      </div>
      {stats && (
        /* أربعة أعمدة على الجوال تكفي أطول رقم فيها، وتتّسع على الشاشة. */
        <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-4">
          {stats}
        </div>
      )}
      {children}
    </li>
  );
}

/** «٣ من ٥» — نسبة تُقرأ بلا حساب. */
export function OutOf({ n, of }: { n: number; of: number }) {
  return (
    <>
      <Num>{toArabicDigits(n)}</Num>
      <span className="text-panel font-normal text-ink-400">/<Num>{toArabicDigits(of)}</Num></span>
    </>
  );
}

/** تاريخ قصير، أو «—». */
export function When({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-ink-400">—</span>;
  return <Num>{toArabicDigits(formatDate(iso))}</Num>;
}

/** رأس التقرير على الشاشة: ما يغطّيه، وكم طالبًا فيه. */
export function ReportHead({
  title, meta, count, countLabel, action,
}: {
  title: string;
  meta?: React.ReactNode;
  count?: number;
  countLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-t2 text-ink-900">{title}</h2>
        {meta && <p className="mt-1 text-xs2 leading-relaxed text-ink-600">{meta}</p>}
        {count !== undefined && (
          <p className="mt-1 text-xs2 text-ink-500">
            <Num className="font-medium text-ink-800">{toArabicDigits(count)}</Num>{' '}
            {countLabel}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** شارة الحال — «متأخر»، «غاب ٣»، «مستحقّ». */
export function Flag({ tone, children }: {
  tone: 'risk' | 'warn' | 'ok' | 'ink'; children: React.ReactNode;
}) {
  return <Chip tone={tone === 'ok' ? 'ok' : tone}>{children}</Chip>;
}
