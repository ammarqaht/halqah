'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   The pieces الرئيسية is built from, after the redesign.

   What was here: four jewel tiles — المستوى، الأجزاء، ما أنجزته، اجتزتها — and a
   progress rail under them, five separate boxes saying five facts about one
   thing. The prototype folded all of it into a single ring with the level in
   the middle of it, and that is what `Journey` is. The facts did not go away;
   they stopped being scattered.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { ChevronLeft, Trophy } from 'lucide-react';
import { Num, juzPhrase, pointWord } from '@/components/Num';
import { Ring } from '@/components/student/motion';
import { cx } from '@/lib/cx';

const CARD = 'rounded-2xl border border-ink-150 bg-paper shadow-soft';

/**
 * مسيرتي في الحفظ.
 *
 * THE RING MEASURES THIS LEVEL — «حلقة المستوى خلّها حلقة تحسب كم أنجز من
 * المستوى هذا» (client, 18 Sep 2026). It used to draw his share of the whole
 * TRACK, which for a boy on level 60 of 60 is two per cent on the day he starts
 * and three per cent a fortnight later: a ring that never visibly moves is a
 * ring nobody looks at twice. What he is actually working through is the
 * twenty-four مقرّرات of the level in front of him, and that arc fills.
 *
 * `at` is what he must recite TODAY, so what he has FINISHED is the one before
 * it. The track's own share keeps its line underneath, because «أين أنا من
 * المسار كله» is still worth one sentence — just not the headline.
 *
 * With no pointer set, the ring falls back to the track exactly as before: a
 * boy nobody has placed must not be shown an invented arc.
 */
export function Journey({ level, ajza, pct, total, at, of }: {
  level: number | null; ajza: number | null; pct: number; total: number;
  /** His مقرّر today, and how many the level holds. */
  at?: number | null; of?: number;
}) {
  const levelled = at != null && !!of && of > 0;
  const done = levelled ? Math.max(0, Math.min(of, at - 1)) : 0;
  const levelPct = levelled ? Math.round((done / of) * 100) : pct;

  return (
    <section className={cx(CARD, 'rise px-[18px] py-4')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base2 font-bold text-ink-900">مسيرتي في الحفظ</h2>
        <Link href="/student/my-level"
          className="press flex shrink-0 items-center gap-1 py-1.5 text-xs2 font-medium text-brand-800">
          خطتي كاملة<ChevronLeft size={14} strokeWidth={2} />
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Ring size={96} stroke={8} pct={levelPct} tone="stroke-brand-700">
          <Num className="font-display text-[30px] leading-none text-ink-900">{level ?? '—'}</Num>
          <span className="mt-[3px] text-2xs text-ink-500">المستوى</span>
        </Ring>

        <div className="min-w-0 flex-1">
          <p className="font-display text-xl2 text-ink-900">
            {ajza != null ? juzPhrase(ajza) : '—'}
          </p>
          <p className="mt-0.5 text-xs2 text-ink-600">محفوظة حتى الآن</p>

          <div className="mt-3 flex items-center justify-between gap-2 text-micro text-ink-500">
            {levelled ? (
              <>
                <span>
                  أنجزت <Num className="font-bold text-brand-800">{done}</Num> من{' '}
                  <Num>{of}</Num> مقرّرًا
                </span>
                <span><Num className="font-medium text-ink-700">{levelPct}٪</Num></span>
              </>
            ) : (
              <>
                <span>أنجزت <Num className="font-bold text-brand-800">{pct}٪</Num> من المسار</span>
                {total > 0 && <span><Num>{total}</Num> ← <Num>1</Num></span>}
              </>
            )}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-brand-700 transition-[width] duration-[1100ms] ease-brand"
              style={{ width: `${Math.max(2, levelPct)}%` }} />
          </div>
          {levelled && (
            <p className="mt-1.5 text-micro text-ink-400">
              ومن المسار كله <Num>{pct}٪</Num>
              {total > 0 && <> · <Num>{total}</Num> ← <Num>1</Num></>}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export type ExamRow = {
  id: string; typeAr: string; takenOn: string; level: number | null;
  score: number | null; scoreMax: number; passed: boolean | null; type: string;
};

/**
 * آخر اختباراتي — a rail of cards rather than a list of rows.
 *
 * A score is a proportion, so it is drawn as one: the ring fills to the share
 * of the mark he took. Pass and fail still carry a WORD as well as a colour,
 * so the card survives a colour-blind reader.
 */
export function ExamRail({ exams, passed, formatDate }: {
  exams: ExamRow[]; passed: number; formatDate: (iso: string) => string;
}) {
  return (
    <section className="rise">
      <div className="flex items-baseline justify-between gap-3 px-0.5 pb-2.5">
        <h2 className="text-base2 font-bold text-ink-900">آخر اختباراتي</h2>
        <span className="shrink-0 text-cap text-ink-500">
          اجتزت <Num className="font-bold text-ink-900">{passed}</Num>{' '}
          {passed === 1 ? 'اختبارًا' : passed === 2 ? 'اختبارين' : 'اختبارات'}
        </span>
      </div>

      <ul className="no-bar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2.5 overflow-x-auto px-5 pb-1 md:mx-0 md:scroll-px-0 md:px-0">
        {exams.map((e) => {
          const ok = e.passed === true;
          const bad = e.passed === false;
          return (
            <li key={e.id}
              className={cx(CARD, 'w-[156px] shrink-0 snap-start p-3.5')}>
              <div className="flex items-center justify-between gap-2">
                <Ring size={48} stroke={5}
                  pct={e.score != null && e.scoreMax ? (e.score / e.scoreMax) * 100 : 0}
                  tone={ok ? 'stroke-ok-700' : bad ? 'stroke-risk-700' : 'stroke-ink-300'}>
                  <Num className="text-xs2 font-bold text-ink-900">{e.score ?? '—'}</Num>
                </Ring>
                <span className={cx('inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-medium',
                  ok ? 'bg-ok-100 text-ok-700'
                    : bad ? 'bg-risk-100 text-risk-700' : 'bg-ink-100 text-ink-500')}>
                  {ok ? 'اجتزت' : bad ? 'لم أجتز' : '—'}
                </span>
              </div>

              <p className={cx('mt-3 truncate text-sm2 font-medium',
                e.type === 'ASSOCIATION' ? 'text-assoc-700' : 'text-ink-900')} title={e.typeAr}>
                {e.typeAr}
              </p>
              <p className="mt-0.5 text-micro text-ink-500">
                <Num>{formatDate(e.takenOn)}</Num>
                {e.scoreMax ? <> · من <Num>{e.scoreMax}</Num></> : null}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** ترتيبي — two glances, both of them a door to الترتيب. */
export function RankTiles({ halaqa, all }: {
  halaqa: { rank: number; total: number } | null;
  all: { rank: number; total: number } | null;
}) {
  if (!halaqa && !all) return null;
  return (
    <div className="rise grid grid-cols-2 gap-2.5">
      <RankTile label="ترتيبي في حلقتي" standing={halaqa} accent />
      <RankTile label="في كل الحلقات" standing={all} />
    </div>
  );
}

function RankTile({ label, standing, accent }: {
  label: string; standing: { rank: number; total: number } | null; accent?: boolean;
}) {
  if (!standing) return null;
  return (
    <Link href="/student/rank"
      className={cx(CARD, 'press px-4 py-3.5 transition-colors hover:border-brand-200')}>
      <p className="text-micro text-ink-500">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <Num className={cx('font-display text-[28px] leading-none',
          accent ? 'text-brand-800' : 'text-ink-900')}>{standing.rank}</Num>
        <span className="text-cap text-ink-500">من <Num>{standing.total}</Num></span>
      </p>
    </Link>
  );
}

/** حركة نقاطي — the ledger, unchanged in substance and tightened in form. */
export function Ledger({ moves, formatDate }: {
  moves: { id: string; delta: number; kindAr: string; reason: string; createdAt: string }[];
  formatDate: (iso: string) => string;
}) {
  return (
    <section className={cx(CARD, 'rise overflow-hidden')}>
      <h2 className="px-[18px] pb-2.5 pt-3.5 text-base2 font-bold text-ink-900">حركة نقاطي</h2>
      <ul>
        {moves.map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-t border-ink-150 px-[18px] py-2.5">
            <Num className={cx('w-12 shrink-0 font-display text-lg2',
              m.delta >= 0 ? 'text-ok-700' : 'text-risk-700')}>
              {m.delta >= 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
            </Num>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm2 text-ink-900">{m.reason || m.kindAr}</p>
              <p className="mt-px text-micro text-ink-500">
                <Num>{formatDate(m.createdAt.slice(0, 10))}</Num>
              </p>
            </div>
            <span className="sr-only">{pointWord(Math.abs(m.delta))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
