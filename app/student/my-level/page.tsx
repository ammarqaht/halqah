'use client';
/* طا-٥ مستواي وخطتي — the screen that answers «ماذا عليّ أن أحفظ اليوم؟»
   without having to ask the teacher.

   Today's day is an ESTIMATE and says so. Nothing in the system records which
   day a boy actually reached, so it is counted from the date the sheet was
   issued — and he can tap any other day. «النظام يقترح، وأنت تقرّر». */
import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Award, ChevronLeft } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Chip, Empty } from '@/components/ui';
import { Num, juzPhrase } from '@/components/Num';
import { useMe } from '@/components/student/Me';
import { COPY } from '@/content/student';
import { formatDate } from '@/lib/dates';
import { PLAN_KIND_AR, type PlanKind } from '@/lib/types';
import { cx } from '@/lib/cx';

type Row = { kind: PlanKind; fromSurah: string; fromAyah: string; toSurah: string; toAyah: string; note: string };
type Day = { dayNo: number; rows: Row[]; examBadge?: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null };
type Data = {
  plan: { level: number; trackAr: string; ajza: number | null; issuedAt: string;
          dayCount: number; dailyAmount: string } | null;
  reason?: string;
  days?: Day[]; currentDayNo?: number; nextLevel?: number; nextAjza?: number | null;
};

const BADGE_AR = { BADGE_GOLDEN: 'اختبار الوسام الذهبي', BADGE_DIAMOND: 'الاختبار الماسي' } as const;

const line = (r: Row) => {
  const a = (v: string) => (v || '—');
  if (!r.fromSurah && !r.toSurah) return '—';
  if (!r.toSurah || r.toSurah === r.fromSurah) {
    return `${r.fromSurah} ${a(r.fromAyah)}–${a(r.toAyah)}`;
  }
  return `${r.fromSurah} ${a(r.fromAyah)} ← ${r.toSurah} ${a(r.toAyah)}`;
};

export default function MyLevel() {
  const { me } = useMe();
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/student/plan').then((r) => (r.ok ? r.json() : { plan: null }))
      .then((x) => { setD(x); setOpen(x.currentDayNo ?? null); })
      .catch(() => setD({ plan: null }));
  }, []);

  if (!d) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skel h-24 rounded-2xl" />)}</div>;
  }

  if (!d.plan) {
    return (
      <Sheet className="rise">
        <Empty icon={BookOpen} title={d.reason === 'TALQEEN' ? 'مسار التلقين' : 'لا خطة بعد'}
          body={d.reason === 'TALQEEN' ? COPY.talqeenPlan : COPY.noPlan} />
      </Sheet>
    );
  }

  const today = d.days?.find((x) => x.dayNo === d.currentDayNo);

  return (
    <div className="space-y-5">
      <Sheet className="rise">
        <SheetHead title="مستواي" meta={`سُلّمت لك في ${formatDate(d.plan.issuedAt.slice(0, 10))}`} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {([
            ['المسار', d.plan.trackAr],
            ['المستوى', <Num key="l">{d.plan.level}</Num>],
            ['يقابل', d.plan.ajza != null ? juzPhrase(d.plan.ajza) : '—'],
            ['المقرَّر اليومي', d.plan.dailyAmount || '—'],
          ] as const).map(([k, v]) => (
            <div key={k}>
              <p className="text-micro text-ink-500">{k}</p>
              <p className="mt-0.5 font-display text-lg2 text-ink-900">{v}</p>
            </div>
          ))}
        </div>
      </Sheet>

      {today && (
        <Sheet className="rise border-brand-200">
          <SheetHead title={COPY.todayEstimate} meta={COPY.todayWhy} />
          {today.examBadge ? (
            <p className="rounded-lg bg-warn-100 px-4 py-3 text-base2 font-medium text-warn-700">
              {BADGE_AR[today.examBadge]}
            </p>
          ) : (
            <ul className="divide-y divide-ink-150">
              {today.rows.map((r) => (
                <li key={r.kind} className="flex items-baseline gap-3 py-2.5">
                  <span className="w-12 shrink-0 text-panel text-ink-500">{PLAN_KIND_AR[r.kind]}</span>
                  <span className="min-w-0 flex-1 text-body text-ink-900">{line(r)}</span>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}

      <Sheet pad={false} className="rise">
        <div className="border-b border-ink-150 px-5 py-4">
          <h2 className="text-lg2 font-bold text-ink-900">خطتي</h2>
          <p className="mt-1 text-panel text-ink-500">
            <Num>{d.plan.dayCount}</Num> يوم — اضغط أي يوم لتراه
          </p>
        </div>
        <ul className="divide-y divide-ink-150">
          {(d.days ?? []).map((day) => {
            const isToday = day.dayNo === d.currentDayNo;
            const isOpen = open === day.dayNo;
            return (
              <li key={day.dayNo}>
                <button onClick={() => setOpen(isOpen ? null : day.dayNo)}
                  className={cx('press flex w-full items-center gap-3 px-5 py-3.5 text-start transition-colors',
                    day.examBadge ? 'bg-warn-100/50' : isToday ? 'bg-brand-50' : 'hover:bg-page/70')}>
                  <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-panel',
                    isToday ? 'bg-brand-800 text-white' : 'bg-ink-100 text-ink-700')}>
                    <Num>{day.dayNo}</Num>
                  </span>
                  <span className="min-w-0 flex-1">
                    {day.examBadge ? (
                      <span className="flex items-center gap-1.5 text-body font-medium text-warn-700">
                        <Award size={15} />{BADGE_AR[day.examBadge]}
                      </span>
                    ) : (
                      <span className="block truncate text-body text-ink-800">
                        {line(day.rows.find((r) => r.kind === 'DARS') ?? day.rows[0])}
                      </span>
                    )}
                    {isToday && <span className="mt-0.5 block text-micro text-brand-800">اليوم — تقديريًا</span>}
                  </span>
                  <ChevronLeft size={16} className={cx('shrink-0 text-ink-400 transition-transform',
                    isOpen && '-rotate-90')} />
                </button>

                {isOpen && !day.examBadge && (
                  <ul className="fade divide-y divide-ink-150 bg-page/40 px-5">
                    {day.rows.map((r) => (
                      <li key={r.kind} className="flex items-baseline gap-3 py-2.5">
                        <span className="w-12 shrink-0 text-panel text-ink-500">{PLAN_KIND_AR[r.kind]}</span>
                        <span className="min-w-0 flex-1 text-panel text-ink-800">{line(r)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>

      {d.nextLevel != null && (
        <Sheet className="rise">
          <SheetHead title="ما بعدي" meta="رؤية الهدف تُعين" />
          <p className="text-base2 text-ink-700">
            المستوى <Num className="font-display text-lg2 text-brand-800">{d.nextLevel}</Num>
            {d.nextAjza != null && <> — {juzPhrase(d.nextAjza)}</>}
          </p>
        </Sheet>
      )}
    </div>
  );
}
