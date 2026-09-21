'use client';
/* أسبوع طالب واحد — خمس خانات، الأحد إلى الخميس.
 *
 * One shape, used wherever a week is shown: the supervisor's student card and
 * the halaqa register both mount this, so a boy's Tuesday can never look like
 * one thing on one screen and another on the next.
 *
 * The three states carry the theme's own tones — brand for what went right,
 * warn for what slipped, risk for what was missed — and a fourth state, «لم
 * يُسجَّل», is drawn as an outline rather than a colour. That is the whole
 * rule this system holds to: silence is not absence, and it must not LOOK like
 * absence either.
 */
import { Check, X, Clock, Minus } from 'lucide-react';
import { Num } from '@/components/Num';
import { WEEKDAY_AR, dayLabel } from '@/lib/week';
import { cx } from '@/lib/cx';

export type StripLine = {
  kind: string; kindAr: string; recited: boolean; errors: number; note?: string | null;
};
export type StripDay = {
  day: string;
  status: string | null;
  statusAr?: string | null;
  future?: boolean;
  thobe?: boolean;
  assignmentNo?: number | null;
  incomplete?: boolean;
  note?: string | null;
  savedBy?: string | null;
  lines?: StripLine[];
  recited?: number;
  errors?: number;
};

const TONE: Record<string, string> = {
  PRESENT: 'border-brand-200 bg-brand-50 text-brand-700',
  LATE: 'border-warn-200 bg-warn-100/60 text-warn-700',
  ABSENT: 'border-risk-200 bg-risk-100/60 text-risk-700',
};
const ICON: Record<string, typeof Check> = { PRESENT: Check, LATE: Clock, ABSENT: X };

export function WeekStrip({
  days, today, onPick, picked, size = 'md',
}: {
  days: StripDay[];
  today?: string;
  onPick?: (day: string | null) => void;
  picked?: string | null;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'py-1.5' : 'py-2.5';
  const ic = size === 'sm' ? 13 : 15;

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {days.map((x, i) => {
        const I = x.status ? ICON[x.status] : Minus;
        const isToday = x.day === today;
        const on = picked === x.day;
        const dots = x.recited ?? (x.lines ?? []).filter((l) => l.recited).length;
        return (
          <button key={x.day} type="button"
            onClick={() => onPick?.(on ? null : x.day)}
            disabled={!x.status || !onPick}
            aria-label={`${WEEKDAY_AR[i]} ${dayLabel(x.day)} — ${x.statusAr ?? 'لم يُسجَّل'}`}
            className={cx('flex flex-col items-center gap-1 rounded-lg border px-1', pad,
              x.status ? TONE[x.status] : 'border-dashed border-ink-200 text-ink-300',
              x.future && 'opacity-40',
              isToday && 'ring-2 ring-ink-400 ring-offset-1',
              on && 'shadow-soft',
              x.status && onPick && 'transition hover:shadow-soft')}>
            <span className="text-micro opacity-75">{WEEKDAY_AR[i]}</span>
            <I size={ic} />
            {/* نقطة لكل سطر سُمِّع — ثلاث نقاط = مقرّر تامّ. */}
            <span className="flex h-1 gap-0.5" aria-hidden>
              {dots > 0 && Array.from({ length: dots }, (_, k) => (
                <i key={k} className="block h-1 w-1 rounded-full bg-current opacity-70" />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** تفصيل يوم واحد — ما سُمِّع، وكم خطأ، وما كتبه المعلم. */
export function DayDetail({ d }: { d: StripDay }) {
  if (!d.status) return null;
  return (
    <div className="fade mt-2.5 rounded-lg border border-ink-150 bg-page/60 px-3.5 py-3">
      <p className="flex items-center gap-2 text-panel font-medium text-ink-900">
        {dayLabel(d.day)} — {d.statusAr}
        {d.assignmentNo != null && (
          <span className="text-cap font-normal text-ink-500">
            المقرّر <Num>{d.assignmentNo}</Num>
          </span>
        )}
        {d.thobe && <span className="text-cap font-normal text-ink-500">· الثوب</span>}
      </p>

      {(d.lines ?? []).length > 0 ? (
        <ul className="mt-2 space-y-1">
          {(d.lines ?? []).map((l) => (
            <li key={l.kind} className="flex items-baseline gap-2 text-panel">
              {l.recited
                ? <Check size={12} className="shrink-0 translate-y-0.5 text-brand-700" />
                : <Minus size={12} className="shrink-0 translate-y-0.5 text-ink-400" />}
              <span className={l.recited ? 'text-ink-800' : 'text-ink-500'}>{l.kindAr}</span>
              {l.recited && l.errors > 0 && (
                <span className="text-cap text-ink-500">
                  <Num>{l.errors}</Num>{' '}
                  {l.errors === 1 ? 'خطأ' : l.errors === 2 ? 'خطآن' : 'أخطاء'}
                </span>
              )}
              {l.note && <span className="text-cap text-ink-500">«{l.note}»</span>}
            </li>
          ))}
        </ul>
      ) : d.status === 'ABSENT' ? (
        <p className="mt-1.5 text-panel text-ink-500">لا تسميع في يوم الغياب.</p>
      ) : (
        <p className="mt-1.5 text-panel text-ink-500">حضر ولم يُسجَّل له تسميع.</p>
      )}

      {d.incomplete && (
        <p className="mt-2 text-cap text-warn-700">تسميع ناقص — انتقل بدرسه دون تمام مراجعته.</p>
      )}
      {d.note && (
        <p className="mt-2 text-panel text-ink-700">
          «{d.note}»
          {d.savedBy && <span className="text-cap text-ink-500"> — {d.savedBy}</span>}
        </p>
      )}
    </div>
  );
}
