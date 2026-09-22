'use client';
/* حضوري وتسميعي — ما سجّله معلمي، أسبوعًا أسبوعًا.
 *
 * The record existed from the afternoon the teacher's portal shipped; the boy
 * it was about could not see it. This is that record read back to him: the five
 * afternoons of his week, whether he was marked present on each, and what he
 * recited — with the arrows to walk back through the term.
 *
 * What it will not do is guess. A day his teacher has not saved shows as «لم
 * يُسجَّل» and not as absence: the register is not a verdict until someone has
 * actually written in it. */
import { useEffect, useState } from 'react';
import { Check, X, Clock, Shirt, Minus, ChevronRight, ChevronLeft } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Num } from '@/components/Num';
import { WEEKDAY_AR, dayLabel, weekLabel } from '@/lib/week';
import { cx } from '@/lib/cx';

type Line = {
  kind: string; kindAr: string; recited: boolean; errors: number; note: string | null;
  passage?: string | null;
};
type Day = {
  day: string; status: 'PRESENT' | 'LATE' | 'ABSENT' | null; statusAr: string | null;
  future: boolean; thobe?: boolean; assignmentNo?: number | null; level?: number | null;
  incomplete?: boolean; note?: string | null; savedBy?: string | null;
  lines: Line[]; recitedCount: number;
  talqeen?: { surah: string; ayah: number | null } | null;
};
type Payload = {
  today: string; week: string; prevWeek: string; nextWeek: string | null;
  isThisWeek: boolean; days: Day[]; mine: Day | null; ever: number;
  summary: { recorded: number; present: number; late: number; absent: number; recited: number };
};

/* The theme's own tones: brand for what went right, warn for what slipped,
   risk for what was missed. Nothing new is invented for this card. */
const TONE: Record<string, string> = {
  PRESENT: 'border-brand-200 bg-brand-50 text-brand-700',
  LATE: 'border-warn-200 bg-warn-100/60 text-warn-700',
  ABSENT: 'border-risk-200 bg-risk-100/60 text-risk-700',
};
const ICON: Record<string, typeof Check> = { PRESENT: Check, LATE: Clock, ABSENT: X };

export function MyDay() {
  const [d, setD] = useState<Payload | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(true);
    fetch(`/api/student/day${week ? `?week=${week}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) { setD(j); setOpen(null); } })
      .catch(() => { /* an empty register is not an error worth a red box */ })
      .finally(() => setBusy(false));
  }, [week]);

  if (!d) return <div className="skel h-[188px] rounded-2xl" />;
  /* Never recorded at all — the portal has not reached his halaqa yet. */
  if (d.ever === 0) return null;

  const shown = d.days.find((x) => x.day === open) ?? null;

  return (
    <Sheet className="rise">
      <SheetHead title="حضوري وتسميعي" meta="ما سجّله معلمك" />

      {/* ── الأسبوع، وسهماه ────────────────────────────────────────────────── */}
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <button onClick={() => setWeek(d.prevWeek)} disabled={busy}
          aria-label="الأسبوع السابق"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-page disabled:opacity-40">
          <ChevronRight size={17} />
        </button>

        <p className={cx('text-base2 text-ink-800 transition', busy && 'opacity-40')}>
          {d.isThisWeek ? 'هذا الأسبوع' : weekLabel(d.week)}
        </p>

        <button onClick={() => d.nextWeek && setWeek(d.nextWeek)} disabled={busy || !d.nextWeek}
          aria-label="الأسبوع التالي"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-page disabled:opacity-30">
          <ChevronLeft size={17} />
        </button>
      </div>

      {/* ── الأحد إلى الخميس ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-1.5">
        {d.days.map((x, i) => {
          const I = x.status ? ICON[x.status] : Minus;
          const isToday = x.day === d.today;
          const picked = open === x.day;
          return (
            <button key={x.day}
              onClick={() => setOpen(picked ? null : x.day)}
              disabled={!x.status}
              aria-label={`${WEEKDAY_AR[i]} ${dayLabel(x.day)} — ${x.statusAr ?? 'لم يُسجَّل'}`}
              className={cx(
                'flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition',
                x.status ? TONE[x.status] : 'border-dashed border-ink-200 text-ink-400',
                x.future && 'opacity-45',
                isToday && 'ring-2 ring-ink-400 ring-offset-1',
                picked && 'shadow-soft',
                x.status && 'hover:shadow-soft')}>
              <span className="text-micro opacity-80">{WEEKDAY_AR[i]}</span>
              <I size={16} />
              <span className="text-micro tabular-nums opacity-90">
                {Number(x.day.split('-')[2])}
              </span>
              {x.recitedCount > 0 && (
                <span className="flex gap-0.5" aria-hidden>
                  {Array.from({ length: x.recitedCount }, (_, k) => (
                    <i key={k} className="block h-1 w-1 rounded-full bg-current opacity-70" />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── يوم مفتوح ──────────────────────────────────────────────────────── */}
      {shown?.status && (
        <div className="fade mt-3.5 rounded-xl border border-ink-150 bg-page/60 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <p className="text-base2 font-medium text-ink-900">
              {dayLabel(shown.day)} — {shown.statusAr}
            </p>
            {shown.thobe && (
              <span className="ms-auto flex items-center gap-1 text-cap text-ink-600">
                <Shirt size={13} /> الثوب
              </span>
            )}
          </div>

          {shown.lines.length > 0 ? (
            <ul className="mt-2.5 space-y-1.5">
              {shown.lines.map((l) => (
                <li key={l.kind} className="flex items-baseline gap-2 text-panel">
                  {l.recited
                    ? <Check size={13} className="shrink-0 translate-y-0.5 text-brand-700" />
                    : <Minus size={13} className="shrink-0 translate-y-0.5 text-ink-400" />}
                  <div className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className={cx(l.recited ? 'text-ink-800' : 'text-ink-500')}>{l.kindAr}</span>
                      {/* سوره وآياته — فيعرف ماذا سمّع لا أنه سمّع فحسب. */}
                      {l.passage && (
                        <span className={cx('text-cap', l.recited ? 'text-ink-600' : 'text-ink-400')}>
                          {l.passage}
                        </span>
                      )}
                      {l.recited && l.errors > 0 && (
                        <span className="text-cap text-ink-500">
                          · <Num>{l.errors}</Num>{' '}
                          {l.errors === 1 ? 'خطأ' : l.errors === 2 ? 'خطآن' : 'أخطاء'}
                        </span>
                      )}
                    </span>
                    {l.note && <span className="block text-cap text-ink-500">«{l.note}»</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : shown.status === 'ABSENT' ? (
            <p className="mt-2 text-panel text-ink-600">لا تسميع في يوم الغياب.</p>
          ) : null}

          {shown.talqeen && (
            <p className="mt-2.5 text-panel text-ink-700">
              وقفت عند سورة {shown.talqeen.surah}
              {shown.talqeen.ayah != null && <> · آية <Num>{shown.talqeen.ayah}</Num></>}
            </p>
          )}

          {shown.incomplete && (
            <p className="mt-2.5 text-cap text-warn-700">
              سمّعت درسك دون تمام المراجعة — ومقرّرك التالي بانتظارك.
            </p>
          )}

          {shown.note && (
            <p className="mt-2.5 text-panel text-ink-700">
              «{shown.note}»
              {shown.savedBy && <span className="text-cap text-ink-500"> — {shown.savedBy}</span>}
            </p>
          )}
        </div>
      )}

      {/* ── حصيلة الأسبوع ──────────────────────────────────────────────────── */}
      {d.summary.recorded > 0 ? (
        <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-panel text-ink-600">
          <span><Num className="font-medium text-ink-900">{d.summary.present}</Num> حاضر</span>
          {d.summary.late > 0 && (
            <span><Num className="font-medium text-ink-900">{d.summary.late}</Num> متأخر</span>
          )}
          <span><Num className="font-medium text-ink-900">{d.summary.absent}</Num> غائب</span>
          <span><Num className="font-medium text-ink-900">{d.summary.recited}</Num> يوم سمّعت فيه</span>
        </div>
      ) : (
        <p className="mt-3.5 text-panel text-ink-500">
          {d.isThisWeek ? 'لم يُسجَّل شيء هذا الأسبوع بعد.' : 'لا تسجيل في هذا الأسبوع.'}
        </p>
      )}

      <p className="mt-2.5 text-cap text-ink-500">
        أسبوع الحلقة من الأحد إلى الخميس. واليوم الذي لم يسجّله معلمك بعد يظهر فارغًا — وليس غيابًا.
      </p>
    </Sheet>
  );
}
