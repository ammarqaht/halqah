'use client';
/* طا-٢ الرئيسية — card, tiles, progress, last exams, ledger.
   Every figure here came from /api/student/*, scoped to this boy by his
   cookie. Nothing on this screen knows another student exists. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers, BookOpen, TrendingUp, ClipboardCheck, ArrowLeft, Check, X,
} from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Empty } from '@/components/ui';
import { Num, juzPhrase, pointWord } from '@/components/Num';
import { useMe } from '@/components/student/Me';
import { StudentCard } from '@/components/student/Card';
import { Tile, ProgressRail } from '@/components/student/Tiles';
import { COPY, LEDGER_ON_HOME } from '@/content/student';
import { formatDate } from '@/lib/dates';
import { levelsFor } from '@/lib/types';
import { cx } from '@/lib/cx';

type ExamRow = {
  id: string; typeAr: string; takenOn: string; level: number | null;
  score: number | null; scoreMax: number; passed: boolean | null; type: string;
};
type Move = { id: string; delta: number; kindAr: string; reason: string; createdAt: string };

export default function StudentHome() {
  const { me } = useMe();
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [moves, setMoves] = useState<Move[] | null>(null);

  useEffect(() => {
    fetch('/api/student/exams').then((r) => (r.ok ? r.json() : { exams: [] }))
      .then((d) => setExams(d.exams ?? [])).catch(() => setExams([]));
    if (me?.eligibleForPoints) {
      fetch(`/api/student/points?limit=${LEDGER_ON_HOME}`)
        .then((r) => (r.ok ? r.json() : { moves: [] }))
        .then((d) => setMoves(d.moves ?? [])).catch(() => setMoves([]));
    } else setMoves([]);
  }, [me?.eligibleForPoints]);

  if (!me) return null;

  const levelled = me.track && me.track !== 'TALQEEN';
  const passed = (exams ?? []).filter((e) => e.passed === true).length;
  const span = levelled ? levelsFor(me.track as 'SILVER' | 'GOLDEN') : [];

  return (
    <div className="space-y-6">
      <StudentCard me={me} />

      {levelled && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="المستوى" value={me.currentLevel ?? 0} icon={Layers} accent="#3F4A45" />
            {/* A count-up cannot say «نصف جزء», so a fractional value is shown
                as the phrase it is rather than rounded to a wrong integer. */}
            {me.ajza != null && !Number.isInteger(me.ajza) ? (
              <div className="tile rise overflow-hidden rounded-2xl border border-ink-150 bg-paper p-4 shadow-soft"
                style={{ ['--tile-accent' as string]: '#6B8F71', animationDelay: '60ms' }}>
                <span className="mb-3 inline-grid h-8 w-8 place-items-center rounded-lg"
                  style={{ background: '#6B8F711A', color: '#6B8F71' }}>
                  <BookOpen size={16} strokeWidth={1.9} />
                </span>
                <p className="text-micro text-ink-500">الأجزاء</p>
                <p className="mt-0.5 font-display text-lg2 leading-tight text-ink-900">
                  {juzPhrase(me.ajza)}
                </p>
              </div>
            ) : (
              <Tile label="الأجزاء" value={me.ajza ?? 0} icon={BookOpen} accent="#6B8F71" delay={60} />
            )}
            <Tile label="ما أنجزته" value={me.progressPct} unit="٪" icon={TrendingUp} accent="#1F7A4C" delay={120} />
            <Tile label="اجتزتها" value={passed} unit="اختبارًا" icon={ClipboardCheck} accent="#0B5F59" delay={180} />
          </div>

          <ProgressRail pct={me.progressPct}
            from={span[0] ?? 0} to={span[span.length - 1] ?? 1} />

          <Link href="/student/my-level"
            className="press flex items-center justify-between rounded-2xl border border-ink-150 bg-paper px-5 py-4 shadow-soft transition-colors hover:border-brand-200">
            <span>
              <span className="block text-body font-medium text-ink-900">خطتي وما عليّ اليوم</span>
              <span className="mt-0.5 block text-panel text-ink-500">
                {me.ajza != null ? juzPhrase(me.ajza) : 'مستواك وخطتك كاملة'}
              </span>
            </span>
            <ArrowLeft size={18} className="shrink-0 text-brand-800" />
          </Link>
        </>
      )}

      {/* آخر اختباراتي — pass and fail carry a SHAPE as well as a colour, so the
          row survives a greyscale printer and a colour-blind reader. */}
      <Sheet pad={false} className="rise">
        <div className="border-b border-ink-150 px-5 py-4">
          <h2 className="text-lg2 font-bold text-ink-900">آخر اختباراتي</h2>
        </div>
        {exams === null ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}
          </div>
        ) : exams.length === 0 ? (
          <div className="p-5"><Empty icon={ClipboardCheck} title="لا اختبارات بعد" body={COPY.noExams} /></div>
        ) : (
          <ul className="divide-y divide-ink-150">
            {exams.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full',
                  e.passed === true ? 'bg-ok-100 text-ok-700'
                    : e.passed === false ? 'bg-risk-100 text-risk-700' : 'bg-ink-100 text-ink-400')}>
                  {e.passed === true ? <Check size={14} strokeWidth={2.6} />
                    : e.passed === false ? <X size={14} strokeWidth={2.6} /> : '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-body',
                    e.type === 'ASSOCIATION' ? 'text-assoc-700' : 'text-ink-900')}>{e.typeAr}</span>
                  <span className="mt-0.5 block text-micro text-ink-500">
                    <Num>{formatDate(e.takenOn)}</Num>
                    {e.level != null && <> · المستوى <Num>{e.level}</Num></>}
                  </span>
                </span>
                {e.score != null && (
                  <span className="shrink-0 text-panel text-ink-700">
                    <Num className="font-medium text-ink-900">{e.score}</Num>
                    <span className="text-ink-400"> / <Num>{e.scoreMax}</Num></span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      {me.eligibleForPoints && (
        <Sheet pad={false} className="rise">
          <div className="border-b border-ink-150 px-5 py-4">
            <h2 className="text-lg2 font-bold text-ink-900">سجلّ نقاطي</h2>
          </div>
          {moves === null ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}
            </div>
          ) : moves.length === 0 ? (
            <div className="p-5"><Empty icon={TrendingUp} title="لا حركة بعد" body={COPY.noMoves} /></div>
          ) : (
            <ul className="divide-y divide-ink-150">
              {moves.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={cx('shrink-0 font-display text-lg2 tabular-nums',
                    m.delta >= 0 ? 'text-ok-700' : 'text-risk-700')}>
                    <Num>{m.delta >= 0 ? `+${m.delta}` : m.delta}</Num>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-ink-900">{m.reason || m.kindAr}</span>
                    <span className="mt-0.5 block text-micro text-ink-500">
                      <Num>{formatDate(m.createdAt.slice(0, 10))}</Num>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </div>
  );
}
