'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   طا-٥ مستواي وخطتي — his level, and the whole sheet.

   The plan was a list twenty-four rows long that had to be scrolled to find
   anything. It is now a grid of twenty-four squares — the whole level visible
   at once, any day opened with one tap — which is the prototype's shape and
   Duolingo's before it: a boy will look at a grid he can see the end of.

   Still NO «today». Nothing records which day a boy actually reached, so
   pointing at one would be a guess, and a guess here sends a child to the wrong
   passage on the system's authority. The grid opens on the first day and he
   finds his place on it, the way he does on paper. When the teacher's screen
   records attendance this can preselect a day and be right.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Award } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Empty } from '@/components/ui';
import { Num, juzPhrase } from '@/components/Num';
import { useMe } from '@/components/student/Me';
import { COPY } from '@/content/student';
import { formatDate } from '@/lib/dates';
import { PLAN_KIND_AR, levelsFor, type PlanKind, type Track } from '@/lib/types';
import { cx } from '@/lib/cx';

type Row = { kind: PlanKind; fromSurah: string; fromAyah: string; toSurah: string; toAyah: string; note: string };
type Day = {
  dayNo: number; rows: Row[];
  examBadge?: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
  association?: boolean;
};
type Data = {
  plan: { level: number; trackAr: string; ajza: number | null; issuedAt: string;
          dayCount: number; dailyAmount: string } | null;
  reason?: string;
  days?: Day[]; nextLevel?: number; nextAjza?: number | null;
};

const BADGE_AR = { BADGE_GOLDEN: 'اختبار الوسام الذهبي', BADGE_DIAMOND: 'الاختبار الماسي' } as const;

/* The three kinds, in the order the sheet reads them, with the tones the
   prototype used — each one already a token. */
const KINDS: { kind: PlanKind; bg: string; fg: string; border: string; dot: string }[] = [
  { kind: 'DARS',           bg: 'bg-brand-100', fg: 'text-brand-800', border: 'border-brand-200', dot: 'bg-brand-800' },
  { kind: 'MURAJAA_SUGHRA', bg: 'bg-info-100',  fg: 'text-info-700',  border: 'border-info-200',  dot: 'bg-info-700' },
  { kind: 'MURAJAA_KUBRA',  bg: 'bg-ok-100',    fg: 'text-ok-700',    border: 'border-ok-200',    dot: 'bg-ok-700' },
];

const CARD = 'rounded-2xl border border-ink-150 bg-paper shadow-soft';

/** «التحريم ١–٤», or «التحريم ١ ← القلم ٢٠» when the row crosses a surah. */
const line = (r: Row | undefined) => {
  if (!r || (!r.fromSurah && !r.toSurah)) return '';
  const a = (v: string) => (v || '—');
  if (!r.toSurah || r.toSurah === r.fromSurah) return `${r.fromSurah} ${a(r.fromAyah)}–${a(r.toAyah)}`;
  return `${r.fromSurah} ${a(r.fromAyah)} ← ${r.toSurah} ${a(r.toAyah)}`;
};

export default function MyLevel() {
  const { me } = useMe();
  const [d, setD] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState(1);

  useEffect(() => {
    fetch('/api/student/plan')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('plan'))))
      .then(setD)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <Sheet className="rise border-risk-200 bg-risk-100">
        <p className="text-base2 text-risk-700">تعذّر تحميل خطتك. أعد تحميل الصفحة.</p>
      </Sheet>
    );
  }

  if (!d) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skel h-28 rounded-2xl" />)}</div>;
  }

  if (!d.plan) {
    return (
      <Sheet className="rise">
        <Empty icon={BookOpen} title={d.reason === 'TALQEEN' ? 'مسار التلقين' : 'لا خطة بعد'}
          body={d.reason === 'TALQEEN' ? COPY.talqeenPlan : COPY.noPlan} />
      </Sheet>
    );
  }

  const days = d.days ?? [];
  const day = days.find((x) => x.dayNo === picked) ?? days[0] ?? null;

  return (
    <div className="space-y-3.5">
      {/* ── where I am, and the road behind me ──────────────────────────── */}
      <section className={cx(CARD, 'rise p-[18px]')}>
        <div className="flex items-center gap-4">
          <span className="flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded-[20px] bg-brand-900 leading-none text-white">
            <Num className="font-display text-[30px]">{d.plan.level}</Num>
            <span className="mt-1 text-[10px] text-brand-200">المستوى</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl2 text-ink-900">المسار {d.plan.trackAr}</p>
            <p className="mt-0.5 text-xs2 text-ink-600">
              {d.plan.ajza != null && <>يقابل {juzPhrase(d.plan.ajza)} · </>}
              المقرَّر اليومي {d.plan.dailyAmount || '—'}
            </p>
            <p className="mt-1.5 text-micro text-ink-500">
              سُلّمت لك في <Num>{formatDate(d.plan.issuedAt.slice(0, 10))}</Num>
            </p>
          </div>
        </div>

        <p className="mb-2 mt-3.5 text-micro text-ink-500">{COPY.levelDown}</p>
        <Ladder track={me?.track ?? null} current={d.plan.level} />
      </section>

      {/* ── the day I am looking at ─────────────────────────────────────── */}
      {day && (
        <section className={cx(CARD, 'rise p-[18px]')}>
          <div className="flex items-center gap-3">
            <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-h3',
              day.examBadge ? 'bg-warn-100 text-warn-700' : 'bg-brand-100 text-brand-800')}>
              <Num>{day.dayNo}</Num>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base2 font-bold text-ink-900">
                {day.examBadge
                  ? <span className="flex flex-wrap items-center gap-1.5 text-warn-700">
                      <Award size={15} />{BADGE_AR[day.examBadge]}
                      {day.association && <span className="text-assoc-700">· اختبار الجمعية</span>}
                    </span>
                  : <>اليوم <Num>{day.dayNo}</Num></>}
              </p>
              <p className="mt-px text-cap text-ink-500">
                {day.examBadge ? 'يوم اختبار — لا درس جديد' : 'درس · مراجعة صغرى · مراجعة كبرى'}
              </p>
            </div>
          </div>

          {day.examBadge ? (
            <div className="mt-3.5 rounded-2xl border border-warn-200 bg-warn-100 px-3 py-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-warn-700">
                <i className="h-2 w-2 rounded-full bg-warn-700" />المطلوب
              </span>
              <p className="mt-2 font-display text-lg2 text-ink-900">
                تسميع ما حُفظ في المستوى كاملًا
              </p>
            </div>
          ) : (
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              {KINDS.map((k, i) => {
                const row = day.rows.find((r) => r.kind === k.kind);
                const text = line(row);
                return (
                  <div key={k.kind}
                    className={cx('rise flex min-h-[104px] flex-col gap-2 rounded-2xl border px-3 py-3',
                      k.bg, k.border)}
                    style={{ animationDelay: `${i * 60}ms` }}>
                    <span className={cx('flex items-center gap-1.5 text-[11px] font-bold', k.fg)}>
                      <i className={cx('h-2 w-2 shrink-0 rounded-full', k.dot)} />
                      {PLAN_KIND_AR[k.kind]}
                    </span>
                    {row?.fromSurah ? (
                      <>
                        <span className="mt-auto font-display text-lg2 leading-[1.3] text-ink-900">
                          {row.fromSurah}
                        </span>
                        <Num className={cx('self-end text-xs2', k.fg)}>
                          {text.slice(row.fromSurah.length).trim()}
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
      )}

      {/* ── the whole level, twenty-four squares of it ───────────────────── */}
      <section className={cx(CARD, 'rise p-[18px]')}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base2 font-bold text-ink-900">خطتي</h2>
          <span className="shrink-0 text-cap text-ink-500">
            <Num>{d.plan.dayCount}</Num> يومًا · اضغط أي يوم
          </span>
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {days.map((x) => {
            const exam = !!x.examBadge;
            const on = x.dayNo === picked;
            const caption = exam
              ? (x.examBadge === 'BADGE_GOLDEN' ? 'الوسام الذهبي' : 'الماسي')
              : line(x.rows.find((r) => r.kind === 'DARS') ?? x.rows[0]);
            return (
              <button key={x.dayNo} type="button" onClick={() => setPicked(x.dayNo)}
                aria-pressed={on}
                aria-label={`اليوم ${x.dayNo}${caption ? ` — ${caption}` : ''}`}
                className={cx('press flex min-h-[58px] flex-col items-center justify-center gap-[3px] rounded-[13px] border px-1.5 py-2 transition-colors',
                  on ? 'border-brand-700 bg-brand-100'
                    : exam ? 'border-warn-200 bg-warn-100' : 'border-ink-150 bg-paper')}>
                <Num className={cx('text-body', on ? 'font-bold text-brand-800' : exam ? 'font-medium text-warn-700' : 'font-medium text-ink-700')}>
                  {x.dayNo}
                </Num>
                {caption && (
                  <span className={cx('max-w-full text-pretty text-center text-[10px] leading-[1.3]',
                    on ? 'text-brand-800' : exam ? 'text-warn-700' : 'text-ink-500')}>
                    {caption}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3.5 text-[11px] text-ink-500">
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm border border-ink-150 bg-paper" />يوم درس
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm border border-warn-200 bg-warn-100" />اختبار
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm border border-brand-700 bg-brand-100" />المعروض
          </span>
        </div>
      </section>

      {/* ── ما بعدي ─────────────────────────────────────────────────────── */}
      {d.nextLevel != null && (
        <div className="rise flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-100 px-[18px] py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-micro text-brand-800">ما بعدي</p>
            <p className="mt-0.5 text-base2 font-medium text-brand-900">
              المستوى <Num>{d.nextLevel}</Num>
              {d.nextAjza != null && <> — {juzPhrase(d.nextAjza)}</>}
            </p>
          </div>
          <span className="shrink-0 text-cap text-brand-800">رؤية الهدف تُعين</span>
        </div>
      )}
    </div>
  );
}

/* Every level of the track, the finished ones behind him. It scrolls the
   current one into view on arrival rather than starting at 60 — the number he
   is on is the only one he is looking for. */
function Ladder({ track, current }: { track: Track | null; current: number }) {
  const here = useRef<HTMLLIElement>(null);
  const levels = track && track !== 'TALQEEN' ? levelsFor(track) : [];

  useEffect(() => {
    here.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [current]);

  if (!levels.length) return null;

  return (
    <ul className="no-bar flex gap-1.5 overflow-x-auto pb-0.5"
      aria-label={`مستويات المسار، من ${levels[0]} إلى 1`}>
      {levels.map((n) => {
        const done = n > current;
        const cur = n === current;
        return (
          <li key={n} ref={cur ? here : undefined}
            aria-current={cur ? 'step' : undefined}
            className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-panel',
              cur ? 'border-brand-800 bg-brand-800 font-bold text-white'
                : done ? 'border-brand-200 bg-brand-100 text-brand-800'
                  : 'border-ink-150 bg-paper text-ink-400')}>
            <Num>{n}</Num>
          </li>
        );
      })}
    </ul>
  );
}
