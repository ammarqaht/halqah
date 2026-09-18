'use client';
/* «عندك اختبار» — the notice a boy needs on the morning he opens the portal.
   Not on the day itself: by then his teacher has told him and a banner is
   noise. It is the days BEFORE that decide whether he prepares. */
import { BookOpenCheck, CalendarClock, Award } from 'lucide-react';
import { Num } from '@/components/Num';
import { formatDate } from '@/lib/dates';
import type { Me } from '@/components/student/Me';
import { cx } from '@/lib/cx';

const BADGE_AR = {
  BADGE_GOLDEN: 'اختبار الوسام الذهبي',
  BADGE_DIAMOND: 'اختبار الوسام الماسي',
  ASSOCIATION: 'اختبار الجمعية',
} as const;

/** «بعد ٣ أيام» reads better than «٣ أيام»; «غدًا» and «اليوم» read better still. */
function whenAr(days: number): string {
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غدًا';
  if (days === 2) return 'بعد يومين';
  if (days <= 10) return `بعد ${days} أيام`;
  return `بعد ${days} يومًا`;
}

/* ── «معلّمك يرى أنك تحتاج مراجعة» ─────────────────────────────────────────
   «ويظهر عند المشرف والطالب ذلك أن الطالب ليس مستعدًّا للاختبار ويحتاج مراجعة»
   (client, 18 Sep 2026).

   Told to the boy himself, and not only about him: being asked to prepare is
   the only part of this he can act on. In his teacher's own words where there
   are any, and signed — a judgement without a name on it is a rumour.

   Amber, not red: this is «راجِع» and not «رسبت». */
export function ExamHold({ me }: { me: Me }) {
  const h = me.examHold;
  if (!h) return null;
  return (
    <div className="rise flex flex-wrap items-start gap-4 rounded-2xl border border-warn-200 bg-warn-100 p-5 shadow-soft">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-warn-700/12 text-warn-700">
        <BookOpenCheck size={20} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg2 font-medium text-warn-700">معلّمك يرى أنك تحتاج مراجعة قبل الاختبار</p>
        {h.note && <p className="mt-1 text-panel leading-relaxed text-warn-700/85">{h.note}</p>}
        <p className="mt-1 text-micro text-ink-500">
          {h.by ? <>{h.by} · </> : null}<Num>{formatDate(h.at.slice(0, 10))}</Num>
        </p>
      </div>
    </div>
  );
}

export function NextExam({ me }: { me: Me }) {
  const e = me.nextExam;
  if (!e) return null;

  /* A week out is a reminder; three days is a nudge; tomorrow is urgent. The
     colour carries that without a word, and the words carry it without the
     colour — either alone is enough to read it. */
  const tone = e.daysAway <= 1 ? 'risk' : e.daysAway <= 3 ? 'warn' : 'info';

  return (
    <div className={cx('rise flex flex-wrap items-center gap-4 rounded-2xl border p-5 shadow-soft',
      tone === 'risk' ? 'border-risk-200 bg-risk-100'
        : tone === 'warn' ? 'border-warn-200 bg-warn-100'
        : 'border-info-200 bg-info-100')}>
      <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full',
        tone === 'risk' ? 'bg-risk-700/12 text-risk-700'
          : tone === 'warn' ? 'bg-warn-700/12 text-warn-700'
          : 'bg-info-700/12 text-info-700')}>
        <CalendarClock size={20} strokeWidth={1.9} />
      </span>

      <div className="min-w-0 flex-1">
        <p className={cx('text-lg2 font-medium',
          tone === 'risk' ? 'text-risk-700' : tone === 'warn' ? 'text-warn-700' : 'text-info-700')}>
          {e.daysAway === 0 ? 'اختبارك اليوم' : `اختبارك ${whenAr(e.daysAway)}`}
        </p>
        <p className={cx('mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-panel',
          tone === 'risk' ? 'text-risk-700/85' : tone === 'warn' ? 'text-warn-700/85' : 'text-info-700/85')}>
          <span className="inline-flex items-center gap-1.5">
            <Award size={14} />{BADGE_AR[e.badge]}
          </span>
          {e.level != null && <span>· المستوى <Num>{e.level}</Num></span>}
          <span>· <Num>{formatDate(e.scheduledOn)}</Num></span>
        </p>
      </div>

      {e.daysAway > 0 && (
        <div className="shrink-0 text-center">
          <p className={cx('font-display text-d2 leading-none',
            tone === 'risk' ? 'text-risk-700' : tone === 'warn' ? 'text-warn-700' : 'text-info-700')}>
            <Num>{e.daysAway}</Num>
          </p>
          <p className="mt-1 text-micro text-ink-500">
            {e.daysAway === 1 ? 'يوم' : e.daysAway === 2 ? 'يومان' : 'أيام'}
          </p>
        </div>
      )}
    </div>
  );
}
