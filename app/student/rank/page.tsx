'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   طا-٦ الترتيب — where I stand, in my halaqa and in the mosque.

   لوحة الشرف (approved PDF §8) has always been printed and pinned to the
   halaqa wall. This is the same two facts — a name and a figure — on the phone
   the boy already has, and it is the only screen on this surface that names
   anyone but him. It still knows nothing it was not given: the board, the
   window and the shortened names are all decided by /api/student/rank, which
   resolves who is asking from the cookie first.

   Top three on a podium and the rest as rows, because a board that ranks
   everyone identically is a spreadsheet.
   ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from 'react';
import { Trophy, RotateCw } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty, Segmented } from '@/components/ui';
import { Num, pointWord, studentWord } from '@/components/Num';
import { useMe } from '@/components/student/Me';
import { COPY } from '@/content/student';
import { cx } from '@/lib/cx';

type Row = { key: string; rank: number; name: string; points: number; me: boolean };
type Board = {
  scope: 'halaqa' | 'all';
  podium: Row[]; rows: Row[]; gapAfter: number | null;
  total: number; mine: { rank: number; total: number; points: number } | null;
  halaqat: number | null; teacher: string | null;
};

export default function RankScreen() {
  const { me } = useMe();
  const [scope, setScope] = useState<'halaqa' | 'all'>('halaqa');
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);

  const eligible = me?.eligibleForPoints ?? true;

  const load = useCallback(() => {
    if (!eligible) return;
    setBoard(null); setFailed(false);
    fetch(`/api/student/rank?scope=${scope}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('rank'))))
      .then(setBoard)
      .catch(() => setFailed(true));
  }, [scope, eligible]);

  useEffect(load, [load]);

  if (me && !eligible) {
    return (
      <Sheet className="rise">
        <Empty icon={Trophy} title="الترتيب لطلاب المسارات" body={COPY.rankTalqeen} />
      </Sheet>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-150 bg-paper px-5 py-4 shadow-soft">
        <h1 className="font-display text-t1 text-ink-900">الترتيب</h1>
        <Segmented value={scope} onChange={setScope}
          options={[
            { value: 'halaqa', label: COPY.rankMine },
            { value: 'all', label: COPY.rankAll },
          ]} />
      </div>

      {/* ── error + retry ───────────────────────────────────────────────── */}
      {failed && (
        <Sheet className="rise border-risk-200 bg-risk-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base2 text-risk-700">{COPY.rankFailed}</p>
            <Btn icon={RotateCw} onClick={load}>أعد المحاولة</Btn>
          </div>
        </Sheet>
      )}

      {/* ── loading ─────────────────────────────────────────────────────── */}
      {!failed && board === null && (
        <>
          <div className="flex items-end justify-center gap-3 px-2">
            {[64, 96, 76].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="skel h-12 w-12 rounded-full" />
                <div className="skel h-3 w-16" />
                <div className="skel w-full rounded-t-xl" style={{ height: h }} />
              </div>
            ))}
          </div>
          <Sheet pad={false} className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}
          </Sheet>
        </>
      )}

      {/* ── empty ───────────────────────────────────────────────────────── */}
      {board && board.total === 0 && (
        <Sheet className="rise">
          <Empty icon={Trophy} title="لا ترتيب بعد"
            body={scope === 'halaqa' ? COPY.noRankHalaqa : COPY.noRankAll} />
        </Sheet>
      )}

      {/* ── content ─────────────────────────────────────────────────────── */}
      {board && board.total > 0 && (
        <>
          {board.podium.length > 0 && (
            <ol className="flex items-end justify-center gap-2.5 px-1">
              {/* second, first, third — the shape a podium has. In RTL the
                  first child sits on the right, which is where second belongs. */}
              {[board.podium[1], board.podium[0], board.podium[2]]
                .filter(Boolean).map((r) => <Step key={r.key} row={r} />)}
            </ol>
          )}

          {board.rows.length > 0 && (
            <Sheet pad={false} className="rise overflow-hidden">
              <ol>
                {board.rows.map((r, i) => (
                  <li key={r.key}>
                    {board.gapAfter === i && (
                      <p aria-hidden="true"
                        className="border-t border-ink-150 py-2.5 text-center tracking-[.3em] text-ink-400">···</p>
                    )}
                    <div className={cx('flex items-center gap-3 border-t border-ink-150 px-5 py-3',
                      r.me && 'bg-brand-50')}>
                      <Num className={cx('w-6 shrink-0 text-center font-display text-body',
                        r.me ? 'text-brand-800' : 'text-ink-500')}>{r.rank}</Num>
                      <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-body',
                        r.me ? 'bg-brand-800 text-white' : 'bg-ink-100 text-ink-700')}>
                        {r.name.trim()[0]}
                      </span>
                      <span className={cx('min-w-0 flex-1 truncate text-body text-ink-900',
                        r.me && 'font-bold')}>{r.name}</span>
                      {r.me && (
                        <span className="grid h-[22px] shrink-0 place-items-center rounded-full bg-brand-800 px-2 text-2xs text-white">
                          {COPY.rankYou}
                        </span>
                      )}
                      <span className="shrink-0 text-panel text-ink-600">
                        <Num className="font-medium text-ink-900">{r.points}</Num> {pointWord(r.points)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </Sheet>
          )}

          <p className="px-1 text-center text-micro text-ink-500">
            {board.scope === 'halaqa'
              ? <>{board.teacher ? `حلقة ${board.teacher}` : 'حلقتك'} · </>
              : <>{board.halaqat != null && <><Num>{board.halaqat}</Num> حلقات · </>}</>}
            <Num>{board.total}</Num> {studentWord(board.total)} · {COPY.rankBasis}
          </p>
        </>
      )}
    </div>
  );
}

/* One place on the podium. First is tallest and gold-ringed; the boy's own
   step is brand-filled wherever it falls, so he finds himself without reading. */
function Step({ row }: { row: Row }) {
  const first = row.rank === 1;
  return (
    <li className="rise flex flex-1 flex-col items-center gap-2"
      style={{ animationDelay: `${row.rank * 80}ms` }}>
      <span className={cx('grid shrink-0 place-items-center rounded-full border-[3px] font-display',
        first ? 'h-[60px] w-[60px] text-h3' : 'h-[50px] w-[50px] text-lg2',
        row.me ? 'border-brand-700 bg-brand-800 text-white'
          : first ? 'border-warn-500 bg-warn-100 text-warn-700'
            : 'border-paper bg-ink-100 text-ink-700')}>
        {row.name.trim()[0]}
      </span>
      <p className={cx('max-w-full truncate text-center text-xs2',
        row.me ? 'font-bold text-brand-800' : 'text-ink-900')}>
        {row.name.split(' ')[0]}
      </p>
      <div className={cx('flex w-full flex-col items-center rounded-t-xl pt-2.5',
        first ? 'h-24' : row.rank === 2 ? 'h-20' : 'h-[68px]',
        first ? 'bg-brand-900 text-white'
          : row.me ? 'bg-brand-800 text-white' : 'bg-brand-100 text-brand-900')}>
        <Num className="font-display text-h2 leading-none">{row.rank}</Num>
        <span className="mt-1 text-[11px] opacity-90">
          <Num>{row.points}</Num> {pointWord(row.points)}
        </span>
      </div>
    </li>
  );
}
