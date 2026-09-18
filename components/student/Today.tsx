'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   مقرّر اليوم — on الرئيسية, and the first thing under the card.

   RESTORED 18 Sep 2026 on the client's instruction. It was pulled out when the
   system could not say which مقرّر a boy had reached: «لا نعرض «اليوم» لأن
   النظام لا يسجّل أين وصل، وأي رقم هنا تخمين» — and a guess here sends a child
   to the wrong passage on the system's own authority, which is worse than
   showing him nothing.

   The teacher's portal removed the reason. `student_progress` holds the مقرّر he
   must recite TODAY, moved by his own teacher's save, so this block is his
   teacher's record read back to him rather than a calculation from the calendar.

   It shows nothing at all — not an empty box, not a «لم يُحدَّد» — when nobody
   has set his pointer, when he has no plan, and on مسار التلقين. A screen that
   only speaks when it has something true to say is the whole rule here.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { Award, Check, ChevronLeft } from 'lucide-react';
import { Num } from '@/components/Num';
import { PLAN_KIND_AR, type PlanKind } from '@/lib/types';
import { cx } from '@/lib/cx';

type Row = {
  kind: PlanKind; fromSurah: string; fromAyah: string;
  toSurah: string; toAyah: string;
};
type Day = { dayNo: number; rows: Row[]; examBadge?: string | null; association?: boolean };
/** What `/api/student/plan` answers. Fetched ONCE on الرئيسية and shared: the
    ring in `Journey` measures the same level this block names, and two fetches
    of one sheet could disagree for a moment on the screen. */
export type StudentPlanPayload = {
  plan: { level: number; trackAr: string; dayCount: number } | null;
  days?: Day[];
  at?: number | null;
  awaitingExam?: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
  done?: { dayNo: number; on: string; incomplete: boolean }[];
};

const BADGE_AR: Record<string, string> = {
  BADGE_GOLDEN: 'اختبار الوسام الذهبي', BADGE_DIAMOND: 'الاختبار الماسي',
};

/* The three, in the order the sheet reads them, in the tones the plan grid uses
   — so the same passage looks the same on both screens. */
const TONE: Record<PlanKind, { bg: string; fg: string; border: string; dot: string }> = {
  DARS:           { bg: 'bg-brand-100', fg: 'text-brand-800', border: 'border-brand-200', dot: 'bg-brand-800' },
  MURAJAA_SUGHRA: { bg: 'bg-info-100',  fg: 'text-info-700',  border: 'border-info-200',  dot: 'bg-info-700' },
  MURAJAA_KUBRA:  { bg: 'bg-ok-100',    fg: 'text-ok-700',    border: 'border-ok-200',    dot: 'bg-ok-700' },
};
const ORDER: PlanKind[] = ['DARS', 'MURAJAA_SUGHRA', 'MURAJAA_KUBRA'];

export function TodayAssignment({ d }: { d: StudentPlanPayload | null }) {
  if (!d?.plan || d.at == null) return null;
  const day = (d.days ?? []).find((x) => x.dayNo === d.at);
  if (!day) return null;

  const did = (d.done ?? []).some((x) => x.dayNo === day.dayNo);
  const waiting = !!d.awaitingExam;

  return (
    <section className="rise overflow-hidden rounded-2xl border border-ink-150 bg-paper shadow-soft">
      <Link href="/student/my-level"
        className="press flex items-center gap-3 px-[18px] pb-2.5 pt-4">
        <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-h3',
          waiting || day.examBadge ? 'bg-warn-100 text-warn-700' : 'bg-brand-100 text-brand-800')}>
          <Num>{day.dayNo}</Num>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base2 font-bold text-ink-900">مقرّر اليوم</span>
            {did && (
              <span className="flex items-center gap-1 rounded-full bg-ok-100 px-2 py-0.5 text-[11px] text-ok-700">
                <Check size={11} strokeWidth={3} />سمّعته
              </span>
            )}
          </span>
          <span className="mt-px block text-cap text-ink-500">
            المستوى <Num>{d.plan.level}</Num>
            {d.plan.dayCount > 0 && <> · المقرّر <Num>{day.dayNo}</Num> من <Num>{d.plan.dayCount}</Num></>}
          </span>
        </span>
        <ChevronLeft size={16} className="shrink-0 text-ink-300" strokeWidth={2} />
      </Link>

      {/* «لا يمضي في الحفظ قبل اختباره» — so on a badge مقرّر there is one thing
          to say and it is not three passages. */}
      {waiting || day.examBadge ? (
        <div className="mx-[18px] mb-4 rounded-2xl border border-warn-200 bg-warn-100 px-3.5 py-3">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-warn-700">
            <Award size={13} strokeWidth={2.2} />
            {BADGE_AR[d.awaitingExam ?? day.examBadge ?? ''] ?? 'اختبار'}
          </span>
          <p className="mt-1.5 font-display text-lg2 leading-snug text-ink-900">
            تسميع ما حُفظ في المستوى كاملًا
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 px-[18px] pb-4">
          {ORDER.map((kind) => {
            const row = day.rows.find((r) => r.kind === kind);
            const t = TONE[kind];
            const to = row && row.toSurah && row.toSurah !== row.fromSurah;
            return (
              <div key={kind}
                className={cx('flex min-h-[92px] flex-col gap-2 rounded-2xl border px-3 py-3',
                  t.bg, t.border)}>
                <span className={cx('flex items-center gap-1.5 text-[11px] font-bold', t.fg)}>
                  <i className={cx('h-2 w-2 shrink-0 rounded-full', t.dot)} />
                  {PLAN_KIND_AR[kind]}
                </span>
                {row?.fromSurah ? (
                  <>
                    <span className="mt-auto font-display text-lg2 leading-[1.3] text-ink-900">
                      {row.fromSurah}
                    </span>
                    <Num className={cx('self-end text-xs2', t.fg)}>
                      {to
                        ? `${row.fromAyah || '—'} ← ${row.toSurah} ${row.toAyah || '—'}`
                        : `${row.fromAyah || '—'}–${row.toAyah || '—'}`}
                    </Num>
                  </>
                ) : (
                  <span className="mt-auto text-panel text-ink-400">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
