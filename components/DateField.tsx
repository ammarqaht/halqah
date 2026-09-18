'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   حقل تاريخ بهوية الموقع — واحدًا كان أو مدّة.

   `<input type="date">` hands the date over to the operating system: a Windows
   flyout in the system's own greys, a Latin-first month grid, an English day
   header on an Arabic screen, and no way to say «الخميس ٦ ربيع الآخر». It is
   the one control in the product that stops looking like the product.

   So this is the calendar drawn here: RTL, the halaqa's palette, Arabic weekday
   letters, both dates on the chosen day, and the Hijri date underneath — the
   calendar the mosque actually speaks in, and the one thing the native picker
   can never show.

   It still keeps the native field's contract: `value` and `onChange` take
   `YYYY-MM-DD`, and `max` refuses anything after it — «ولا يمكن تحديد ولا
   الانتقال ليوم مستقبلي» is enforced here, not hinted at.

   TWO FIELDS, ONE GRID. `DateField` picks a day; `DateRangeField` picks a period
   in ONE calendar, first tap «من» and second «إلى» — «وأظن الفكرة هذي أفضل»
   (client, 18 Sep 2026), and it is: two separate calendars can be set to an
   impossible order and then have to argue with the reader about it, while one
   calendar cannot express an end before its own start.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { HijriText, Num } from '@/components/Num';
import { WEEKDAY_AR } from '@/lib/teacher';
import { asDate, isoDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

/** ح ن ث ر خ ج س — one letter each, because seven headers must fit a phone. */
const DAY_INITIALS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const shift = (iso: string, days: number) => {
  const d = asDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

/** «١٨ سبتمبر ٢٠٢٦», laid out so an Arabic line reads it from the right.
    `year={false}` drops it — for the first end of a period whose other end is in
    the same year, where saying it twice is saying it once too often. */
function Gregorian({ iso, year = true }: { iso: string; year?: boolean }) {
  const d = asDate(iso);
  if (!d) return <>—</>;
  return (
    <>
      <Num>{d.getDate()}</Num> {MONTHS_AR[d.getMonth()]}
      {year && <> <Num>{d.getFullYear()}</Num></>}
    </>
  );
}

/* ── the grid both fields share ──────────────────────────────────────────── */

function MonthGrid({ cursor, setCursor, max, min, isOn, inRange, onPick, onHover }: {
  cursor: Date;
  setCursor: (d: Date) => void;
  max?: string; min?: string;
  isOn: (iso: string) => boolean;
  inRange?: (iso: string) => boolean;
  onPick: (iso: string) => void;
  onHover?: (iso: string | null) => void;
}) {
  const today = isoDate(new Date());
  const allowed = (iso: string) => (!max || iso <= max) && (!min || iso >= min);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const out: (string | null)[] = [];
    /* Sunday-first, matching `Date.getDay()` and the halaqa's own week. */
    for (let i = 0; i < first.getDay(); i++) out.push(null);
    const last = new Date(year, month + 1, 0).getDate();
    for (let n = 1; n <= last; n++) out.push(isoDate(new Date(year, month, n)));
    return out;
  }, [cursor]);

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" aria-label="الشهر السابق"
          disabled={!!min && isoDate(new Date(cursor.getFullYear(), cursor.getMonth(), 0)) < min}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="press grid h-8 w-8 place-items-center rounded-lg border border-ink-200 text-ink-600 disabled:opacity-35">
          <ChevronRight size={15} strokeWidth={2} />
        </button>
        <span className="text-panel font-medium text-ink-900">
          {MONTHS_AR[cursor.getMonth()]} <Num>{cursor.getFullYear()}</Num>
        </span>
        <button type="button" aria-label="الشهر التالي"
          disabled={!!max && isoDate(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) > max}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="press grid h-8 w-8 place-items-center rounded-lg border border-ink-200 text-ink-600 disabled:opacity-35">
          <ChevronLeft size={15} strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAY_INITIALS.map((x, i) => (
          <span key={i} className="pb-1 text-micro text-ink-400">{x}</span>
        ))}
        {days.map((iso, i) => {
          if (!iso) return <span key={`p${i}`} />;
          const can = allowed(iso);
          const on = isOn(iso);
          const mid = !on && !!inRange?.(iso);
          return (
            <button key={iso} type="button" disabled={!can}
              onClick={() => onPick(iso)}
              onMouseEnter={() => onHover?.(iso)}
              aria-current={on ? 'date' : undefined}
              className={cx('press grid h-9 place-items-center rounded-lg text-panel tabular-nums transition-colors',
                on ? 'bg-brand-800 font-medium text-white'
                  : mid ? 'bg-brand-100 text-brand-800'
                  : iso === today ? 'border border-brand-300 text-brand-800'
                  : 'text-ink-800 hover:bg-brand-50',
                /* «خلّي الأيام المستقبلية باهتة لكي يتضح للشخص أنه ما يمكن
                   الضغط عليها» (client, 18 Sep 2026). It was a grey that could
                   be taken for an ordinary day at arm's length; it is faded and
                   flat now, and it takes no hover at all. */
                !can && 'pointer-events-none opacity-30 hover:bg-transparent')}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ── يوم واحد ────────────────────────────────────────────────────────────── */

export type DateFieldProps = {
  value: string;
  onChange: (iso: string) => void;
  /** Inclusive. Nothing after it can be chosen OR stepped to. */
  max?: string;
  /** Inclusive. */
  min?: string;
  label?: string;
  /** `dark` sits on the brand field — the hero's ground. */
  tone?: 'light' | 'dark';
  /** Show ‹ › steppers either side of the field. */
  steppers?: boolean;
  /** Put the Hijri date under the Gregorian one. */
  hijriToo?: boolean;
  /**
   * Which chrome the trigger wears.
   *
   * `portal` is the rounded card surface of بوابة المعلم والطالب, where this
   * control stands on its own. `field` is the supervisor's FORM chrome — the
   * same height, radius, padding and type as `INPUT` and `Combobox` — because
   * beside them anything else reads as a foreign control: «خانة التاريخ في
   * تسجيل اختبار ما ضبطتها على هوية الموقع» (client, 18 Sep 2026).
   */
  chrome?: 'portal' | 'field';
  className?: string;
};

export function DateField({
  value, onChange, max, min, label, tone = 'light', steppers, hijriToo,
  chrome = 'portal', className,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  /* Which month the grid is showing — follows the value, and is moved by the
     month arrows without choosing anything. */
  const [cursor, setCursor] = useState(() => asDate(value) ?? new Date());
  useEffect(() => { const d = asDate(value); if (d) setCursor(d); }, [value]);
  useAway(box, open, () => setOpen(false));

  const d = asDate(value);
  const canGo = (iso: string) => (!max || iso <= max) && (!min || iso >= min);
  const dark = tone === 'dark';

  const form = chrome === 'field' && !dark;
  const icon = (
    <CalendarDays size={16} strokeWidth={1.9}
      className={cx('shrink-0', dark ? 'text-brand-200' : 'text-ink-400')} />
  );
  const field = (
    <button type="button" onClick={() => setOpen((o) => !o)}
      aria-haspopup="dialog" aria-expanded={open}
      aria-label={label ?? 'اختر التاريخ'}
      className={cx('press flex flex-1 items-center gap-2 border text-start transition-colors',
        form
          ? 'h-11 rounded-md border-ink-200 bg-paper px-3.5 text-ink-900 hover:border-ink-300'
          : 'min-h-[42px] rounded-xl px-3',
        !form && (dark
          ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
          : 'border-ink-200 bg-paper text-ink-900 hover:border-ink-300'))}>
      {/* In form chrome the icon sits at the END, where `Combobox` keeps its
          chevron — two fields in one row that open the same way should open
          from the same side. */}
      {!form && icon}
      {/* ── نصّ التاريخ ─────────────────────────────────────────────────────
          Only the two NUMBERS are isolated; the Arabic between them flows the
          way the line does, so «١٨ سبتمبر ٢٠٢٦» reads from the right at every
          width. `<Num>` around the whole date forced it LTR and put the day on
          the wrong end of the month. */}
      <span className="min-w-0 flex-1 leading-tight">
        <span className={cx('flex items-baseline gap-x-1.5 whitespace-nowrap',
          form ? 'text-base2' : 'text-panel',
          dark ? 'text-brand-100' : 'text-ink-700')}>
          <span className={cx('font-medium', dark ? 'text-white' : 'text-ink-900')}>
            {d ? WEEKDAY_AR[d.getDay()] : '—'}
          </span>
          {d && <span><Gregorian iso={value} /></span>}
        </span>
        {hijriToo && d && (
          <span className={cx('mt-0.5 block whitespace-nowrap text-micro',
            dark ? 'text-brand-300' : 'text-ink-500')}>
            <HijriText day={value} />
          </span>
        )}
      </span>
      {form && icon}
    </button>
  );

  return (
    <div ref={box} className={cx('relative', className)}>
      <div className="flex items-stretch gap-1.5">
        {/* RTL: «السابق» is the arrow pointing right — towards where earlier
            text sits. Disabled rather than hidden when it would cross a bound,
            so the control keeps its shape. */}
        {steppers && (
          <Stepper dir="prev" dark={dark} disabled={!canGo(shift(value, -1))}
            onClick={() => onChange(shift(value, -1))} />
        )}
        {field}
        {steppers && (
          <Stepper dir="next" dark={dark} disabled={!canGo(shift(value, 1))}
            onClick={() => onChange(shift(value, 1))} />
        )}
      </div>

      {open && (
        <div role="dialog" aria-label={label ?? 'التقويم'}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-50 rounded-2xl border border-ink-150 bg-paper p-3 shadow-pop">
          <MonthGrid cursor={cursor} setCursor={setCursor} max={max} min={min}
            isOn={(iso) => iso === value}
            onPick={(iso) => { onChange(iso); setOpen(false); }} />

          {/* The Hijri date of whatever is chosen — the thing the native picker
              cannot say, and the calendar the halaqa speaks in. */}
          <p className="mt-2.5 border-t border-ink-150 pt-2 text-center text-micro text-ink-500">
            <HijriText day={value} />
          </p>

          {max && value !== max && (
            <button type="button" onClick={() => { onChange(max); setOpen(false); }}
              className="press mt-1.5 w-full rounded-lg py-1.5 text-panel font-medium text-brand-800">
              اليوم
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── مدّة، في تقويم واحد ─────────────────────────────────────────────────── */

/** How many days a period is, inclusive — what the field says under the dates. */
const span = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000) + 1;

export function DateRangeField({
  from, to, onChange, max, min, label, chrome = 'portal', className,
}: {
  from: string; to: string;
  onChange: (from: string, to: string) => void;
  max?: string; min?: string; label?: string;
  /** See `DateFieldProps.chrome`. */
  chrome?: 'portal' | 'field';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  /** Set once the first tap has landed and the second has not. */
  const [start, setStart] = useState<string | null>(null);
  /** What the grid would select if the pointer stopped here — the preview. */
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(() => asDate(to) ?? new Date());

  useEffect(() => { if (!open) { setStart(null); setHover(null); } }, [open]);
  useAway(box, open, () => setOpen(false));

  /* One tap sets «من» and the next sets «إلى», and then it closes. A second tap
     BEFORE the first simply becomes the new start rather than an error — «فلا
     يمكن تحديد الفترة الثانية قبل الأولى» is then true by construction, and a
     rule that cannot be broken never has to be explained. */
  const pick = (iso: string) => {
    if (start === null) { setStart(iso); setHover(iso); return; }
    /* Earlier than the start he just set: he is re-choosing the start, not
       asking for a period that runs backwards. */
    if (iso < start) { setStart(iso); setHover(iso); return; }
    onChange(start, iso);
    setStart(null); setHover(null); setOpen(false);
  };

  const a = start ?? from;
  const b = start !== null ? (hover ?? start) : to;
  const lo = a <= b ? a : b;
  const hi = a <= b ? b : a;
  const days = from && to ? span(from, to) : 0;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);

  return (
    <div ref={box} className={cx('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog" aria-expanded={open}
        aria-label={label ?? 'اختر المدة'}
        className={cx('press flex w-full items-center gap-2.5 border border-ink-200 bg-paper text-start transition-colors hover:border-ink-300',
          chrome === 'field'
            ? 'h-11 rounded-md px-3.5'
            : 'min-h-[46px] rounded-xl px-3')}>
        {chrome !== 'field' &&
          <CalendarDays size={16} strokeWidth={1.9} className="shrink-0 text-ink-400" />}
        {/* «أبي خانة التاريخ تكون نصوصها بشكل منسّق أكثر» (client, 18 Sep 2026).
            Two dates in one field are one PHRASE, not two facts stacked: the
            year is said once when both ends share it, the two days carry the
            weight, and the length of the period rides at the other end as a
            figure rather than as a second line under everything. */}
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-panel text-ink-900">
            <span className="font-medium"><Gregorian iso={from} year={!sameYear} /></span>
            <span className="mx-1.5 text-ink-300">←</span>
            <span className="font-medium"><Gregorian iso={to} /></span>
          </span>
          <span className="shrink-0 rounded-lg bg-page px-2 py-1 text-micro text-ink-600">
            {days > 0 ? <><Num className="font-medium text-ink-800">{days}</Num> يومًا</> : 'اختر'}
          </span>
        </span>
        {chrome === 'field' &&
          <CalendarDays size={16} strokeWidth={1.9} className="shrink-0 text-ink-400" />}
      </button>

      {open && (
        <div role="dialog" aria-label={label ?? 'التقويم'}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-50 rounded-2xl border border-ink-150 bg-paper p-3 shadow-pop">
          {/* The calendar says which of the two taps it is waiting for: a grid
              that behaves differently on alternate taps must say which tap this
              one is. */}
          <p className="mb-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-center text-micro font-medium text-brand-800">
            {start === null ? 'اضغط يوم البداية' : 'واضغط يوم النهاية'}
          </p>

          <div onMouseLeave={() => setHover(null)}>
            {/* The days BEFORE the start stay live on purpose. Greying them out
                would enforce the order — «فلا يمكن تحديد الفترة الثانية قبل
                الأولى» — but it would also trap a reader who mis-tapped his
                start into closing the calendar to try again. Tapping earlier
                simply moves the start there, so the order still cannot be
                broken and nothing has to be undone. Only the FUTURE is faded,
                because no tap can ever make it choosable. */}
            <MonthGrid cursor={cursor} setCursor={setCursor}
              max={max} min={min}
              isOn={(iso) => iso === lo || iso === hi}
              inRange={(iso) => iso > lo && iso < hi}
              onHover={(iso) => { if (start !== null) setHover(iso); }}
              onPick={pick} />
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-ink-150 pt-2 text-center text-micro text-ink-500">
            <span>
              من<br /><HijriText day={start ?? from} />
            </span>
            <span>
              إلى<br />{start === null ? <HijriText day={to} /> : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── shared bits ─────────────────────────────────────────────────────────── */

/** Close on a click outside, and on Escape. */
function useAway(
  box: React.RefObject<HTMLDivElement | null>, open: boolean, close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  });
}

function Stepper({ dir, dark, disabled, onClick }: {
  dir: 'prev' | 'next'; dark: boolean; disabled: boolean; onClick: () => void;
}) {
  const I = dir === 'prev' ? ChevronRight : ChevronLeft;
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      aria-label={dir === 'prev' ? 'اليوم السابق' : 'اليوم التالي'}
      className={cx('press grid w-10 shrink-0 place-items-center rounded-xl border transition-colors disabled:opacity-30',
        dark
          ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
          : 'border-ink-200 bg-paper text-ink-600 hover:border-ink-300')}>
      <I size={17} strokeWidth={2} />
    </button>
  );
}
