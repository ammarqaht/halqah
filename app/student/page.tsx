'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   طا-٢ الرئيسية — the card, his progress, his exams, his ledger.

   Every figure here came from /api/student/*, scoped to this boy by his
   cookie. Nothing on this screen knows another student exists — except the two
   ranking figures, and those arrive already reduced to «place out of total» by
   a route that names nobody (see app/api/student/rank).

   No «today» card. `/api/student/plan` deliberately points at no day — nothing
   records which one a boy actually reached — so this screen does not invent one
   either. It links to the whole sheet instead.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { ClipboardCheck, TrendingUp } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Empty } from '@/components/ui';
import { useMe } from '@/components/student/Me';
import { StudentCard } from '@/components/student/Card';
import { NextExam } from '@/components/student/NextExam';
import { Journey, ExamRail, RankTiles, Ledger, type ExamRow } from '@/components/student/Tiles';
import { COPY, LEDGER_ON_HOME } from '@/content/student';
import { formatDate } from '@/lib/dates';

type Move = { id: string; delta: number; kindAr: string; reason: string; createdAt: string };
type Standing = { rank: number; total: number } | null;

export default function StudentHome() {
  const { me } = useMe();
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [inHalaqa, setInHalaqa] = useState<Standing>(null);
  const [overall, setOverall] = useState<Standing>(null);

  const eligible = me?.eligibleForPoints ?? false;

  useEffect(() => {
    fetch('/api/student/exams').then((r) => (r.ok ? r.json() : { exams: [] }))
      .then((d) => setExams(d.exams ?? [])).catch(() => setExams([]));
  }, []);

  useEffect(() => {
    if (!eligible) { setMoves([]); return; }
    fetch(`/api/student/points?limit=${LEDGER_ON_HOME}`)
      .then((r) => (r.ok ? r.json() : { moves: [] }))
      .then((d) => setMoves(d.moves ?? [])).catch(() => setMoves([]));

    /* The board is a bonus on this screen, not its subject: if either scope
       fails or refuses, the chip and the tile simply are not there. */
    const standing = (scope: 'halaqa' | 'all', set: (s: Standing) => void) =>
      fetch(`/api/student/rank?scope=${scope}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.mine) set({ rank: d.mine.rank, total: d.mine.total }); })
        .catch(() => { /* no chip */ });
    void standing('halaqa', setInHalaqa);
    void standing('all', setOverall);
  }, [eligible]);

  if (!me) return null;

  const levelled = !!me.track && me.track !== 'TALQEEN';
  const passed = (exams ?? []).filter((e) => e.passed === true).length;

  return (
    <div className="space-y-3.5">
      <StudentCard me={me} standing={inHalaqa} />

      {/* Above everything but the card: an exam he has not prepared for is the
          most useful thing this screen can tell him. */}
      <NextExam me={me} />

      {levelled && (
        <Journey level={me.currentLevel} ajza={me.ajza}
          pct={me.progressPct} total={me.levelTotal} />
      )}

      {/* آخر اختباراتي */}
      {exams === null ? (
        <div className="no-bar -mx-5 flex gap-2.5 overflow-hidden px-5 md:mx-0 md:px-0">
          {[0, 1, 2].map((i) => <div key={i} className="skel h-[150px] w-[156px] shrink-0 rounded-2xl" />)}
        </div>
      ) : exams.length === 0 ? (
        <Sheet className="rise">
          <Empty icon={ClipboardCheck} title="لا اختبارات بعد" body={COPY.noExams} />
        </Sheet>
      ) : (
        <ExamRail exams={exams.slice(0, 8)} passed={passed} formatDate={formatDate} />
      )}

      {eligible && <RankTiles halaqa={inHalaqa} all={overall} />}

      {/* حركة نقاطي */}
      {eligible && (
        moves === null ? (
          <div className="space-y-2 rounded-2xl border border-ink-150 bg-paper p-5 shadow-soft">
            {[0, 1, 2].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}
          </div>
        ) : moves.length === 0 ? (
          <Sheet className="rise">
            <Empty icon={TrendingUp} title="لا حركة بعد" body={COPY.noMoves} />
          </Sheet>
        ) : (
          <Ledger moves={moves} formatDate={formatDate} />
        )
      )}
    </div>
  );
}
