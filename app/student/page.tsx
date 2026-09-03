'use client';
/* طا-٢ الرئيسية — how many points do I have, where am I, what did I do. */
import Link from 'next/link';
import { useMemo } from 'react';
import { Ticket, Store, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty } from '@/components/ui';
import { Num, juzWord } from '@/components/Num';
import { useDB } from '@/lib/store';
import { useStudentId, StudentPicker } from '@/components/StudentGate';
import { balanceOf, earnsPoints, EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { ajzaForLevel } from '@/lib/exams';
import { TRACK_AR, TXN_KIND_AR } from '@/lib/types';
import { formatDate } from '@/lib/dates';

export default function StudentHome() {
  const db = useDB();
  const [id, setId] = useStudentId();
  const me = db.students.find((s) => s.id === id) ?? null;

  const plan = useMemo(() => [...db.plans]
    .filter((p) => p.studentId === id)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0] ?? null, [db.plans, id]);

  const exams = useMemo(() => db.exams
    .filter((e) => e.studentId === id)
    .sort((a, b) => b.takenOn.localeCompare(a.takenOn)).slice(0, 5), [db.exams, id]);

  const moves = useMemo(() => db.txns
    .filter((t) => t.studentId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [db.txns, id]);

  if (!me) return <StudentPicker onPick={setId} />;

  const level = me.currentLevel ?? plan?.level ?? null;
  const ajza = ajzaForLevel(me.track, level);
  const total = me.track === 'GOLDEN' ? 30 : 60;
  const pct = level ? Math.round(((total - level) / total) * 100) : 0;
  const balance = balanceOf(db.txns, me.id);
  const eligible = earnsPoints(me);

  return (
    <div className="mx-auto max-w-lg px-5 py-6">
      <p className="text-xs2 text-ink-500">أهلًا</p>
      <h1 className="mt-0.5 font-display text-d2 text-ink-900">{me.fullName}</h1>

      {eligible ? (
        <Sheet className="mt-5 border-brand-200 bg-brand-50">
          <p className="text-xs2 text-brand-800">رصيدي من النقاط</p>
          <p className="mt-1 font-display text-d0 leading-none text-brand-900"><Num>{balance}</Num></p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link href="/student/redeem"><Btn variant="primary" size="lg" icon={Ticket} className="w-full">شحن كود</Btn></Link>
            <Link href="/student/store"><Btn size="lg" icon={Store} className="w-full">المتجر</Btn></Link>
          </div>
        </Sheet>
      ) : (
        <Sheet className="mt-5">
          <p className="text-base2 text-ink-600">
            أنت في مسار التلقين، وطلابه خارج نظام النقاط والمتجر.
          </p>
        </Sheet>
      )}

      {level !== null && (
        <Sheet className="mt-4">
          <SheetHead title="مستواي"
            meta={me.track ? `المسار ${TRACK_AR[me.track]}` : undefined} />
          <div className="flex items-baseline gap-3">
            <span className="font-display text-d1 text-ink-900"><Num>{level}</Num></span>
            {ajza !== null && <Chip tone="brand">{juzWord(ajza)}</Chip>}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-brand"
              style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-micro text-ink-500">
            أنجزت <Num>{pct}</Num>٪ من مسارك · المستوى ينزل من <Num>{total}</Num> إلى <Num>١</Num>
          </p>
          <Link href="/student/my-level"
            className="mt-4 block text-panel text-brand-800 hover:underline">خطتي وما عليّ اليوم ←</Link>
        </Sheet>
      )}

      {exams.length > 0 && (
        <Sheet className="mt-4">
          <SheetHead title="آخر اختباراتي" />
          <ul className="divide-y divide-ink-150">
            {exams.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                {e.passed
                  ? <CheckCircle2 size={16} className="shrink-0 text-ok-500" />
                  : <XCircle size={16} className="shrink-0 text-risk-500" />}
                <span className="min-w-0 flex-1 truncate text-body text-ink-900">
                  {EXAM_TYPE_AR[e.type as ExamType] ?? e.type}
                </span>
                <Num className="shrink-0 text-micro text-ink-500">{formatDate(e.takenOn)}</Num>
                <Num className="w-10 shrink-0 text-end text-panel font-medium text-ink-900">{e.score ?? '—'}</Num>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {eligible && moves.length > 0 && (
        <Sheet className="mt-4">
          <SheetHead title="حركة نقاطي" />
          <ul className="divide-y divide-ink-150">
            {moves.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <TrendingUp size={15}
                  className={t.delta >= 0 ? 'shrink-0 text-ok-500' : 'shrink-0 rotate-180 text-risk-500'} />
                <span className="min-w-0 flex-1 truncate text-panel text-ink-700">
                  {t.reason || TXN_KIND_AR[t.kind]}
                </span>
                <span className={t.delta >= 0 ? 'text-body font-medium text-ok-700' : 'text-body font-medium text-risk-700'}>
                  {t.delta >= 0 ? '+' : '−'}<Num>{Math.abs(t.delta)}</Num>
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      <button onClick={() => setId('')}
        className="mt-8 w-full text-center text-micro text-ink-400 hover:text-ink-700">
        لست {me.fullName}؟ تغيير
      </button>
    </div>
  );
}
