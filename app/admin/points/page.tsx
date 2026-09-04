'use client';
/* النقاط — SPEC.md §6.4, approved PDF §8 (إد-٤-أ).
   «الهدف الأساسي أن يكون عندي برنامج أستبدل فيه النقاط» — the client's own
   sentence, and the reason this screen exists.

   One screen, three views of the same ledger: the balances he scans, the
   movements he audits, and the ten names he prints and pins up in the halaqa.
   Nothing here stores a balance; every figure is summed from `point_txns`, so
   the table and the ledger cannot disagree. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Coins, Search, Plus, Ticket, Inbox, X, ArrowDownUp, Printer, Undo2, Trophy, Home } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Modal, Field, INPUT, Segmented } from '@/components/ui';
import { KPI } from '@/components/Stat';
import { Num, studentWord, pointWord } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { GrantDialog } from '@/components/GrantDialog';
import { store, useDB } from '@/lib/store';
import { balances, earnsPoints, EMPTY_BALANCE } from '@/lib/points';
import { TRACK_AR, TXN_KIND_AR, type PointTxn, type TxnKind } from '@/lib/types';
import { foldArabic, shortName } from '@/lib/normalise';
import { formatDateTime, relativeDay } from '@/lib/dates';
import { cx } from '@/lib/cx';

type View = 'BALANCES' | 'LEDGER' | 'HONOUR';
type SortKey = 'balance' | 'name' | 'last';

const KIND_TONE: Record<TxnKind, 'ok' | 'brand' | 'info' | 'risk' | 'warn' | 'ink'> = {
  MANUAL: 'ink', CODE: 'brand', EXAM: 'info',
  PURCHASE: 'risk', REFUND: 'warn', CORRECTION: 'warn',
};

function PointsScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const [view, setView] = useState<View>('BALANCES');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('balance');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [granting, setGranting] = useState(false);
  const [kindFilter, setKindFilter] = useState<TxnKind | ''>('');
  const [correcting, setCorrecting] = useState<PointTxn | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');

  const halaqaFilter = sp.get('halaqa');
  const halaqa = halaqaFilter && halaqaFilter !== 'none'
    ? db.halaqat.find((h) => h.id === halaqaFilter) ?? null : null;

  /* Filtering swaps the query string without unmounting the screen, so an open
     dialog would hang over a view it no longer belongs to. Same rule as the
     roster (SPEC.md §6.2). */
  const filterKey = sp.toString();
  useEffect(() => { setGranting(false); setSel(new Set()); setCorrecting(null); }, [filterKey]);

  const bal = useMemo(() => balances(db.txns), [db.txns]);
  const halaqaOf = (id: string | null) => {
    const t = id ? db.halaqat.find((h) => h.id === id)?.teacher : null;
    return t ? shortName(t) : '—';
  };

  /* §4.11 — Talqeen students are excluded from every path on this screen. */
  const eligible = useMemo(() => db.students.filter(earnsPoints), [db.students]);
  const talqeenCount = db.students.length - eligible.length;

  const rows = useMemo(() => {
    const needle = foldArabic(q);
    const list = eligible.filter((s) => {
      if (halaqaFilter === 'none' ? s.halaqaId : halaqaFilter ? s.halaqaId !== halaqaFilter : false) return false;
      if (needle && !foldArabic(s.fullName).includes(needle) && !(s.nationalId ?? '').includes(q.trim())) return false;
      return true;
    }).map((s) => ({ s, b: bal.get(s.id) ?? EMPTY_BALANCE }));

    return list.sort((a, b) => {
      if (sort === 'name') return a.s.fullName.localeCompare(b.s.fullName, 'ar');
      if (sort === 'last') return (b.b.lastAt ?? '').localeCompare(a.b.lastAt ?? '');
      return b.b.balance - a.b.balance || a.s.fullName.localeCompare(b.s.fullName, 'ar');
    });
  }, [eligible, halaqaFilter, q, bal, sort]);

  const totals = useMemo(() => {
    const scope = new Set(rows.map((r) => r.s.id));
    let circulating = 0, granted = 0, redeemed = 0, moves = 0;
    for (const r of rows) {
      circulating += r.b.balance; granted += r.b.granted; redeemed += r.b.redeemed; moves += r.b.moves;
    }
    return { circulating, granted, redeemed, moves, scope };
  }, [rows]);

  const ledger = useMemo(() => {
    const needle = foldArabic(q);
    return db.txns
      .filter((t) => {
        if (!totals.scope.has(t.studentId)) return false;
        if (kindFilter && t.kind !== kindFilter) return false;
        if (needle) {
          const s = db.students.find((x) => x.id === t.studentId);
          if (!foldArabic(s?.fullName ?? '').includes(needle) && !foldArabic(t.reason).includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [db.txns, db.students, totals.scope, kindFilter, q]);

  /* «لوحة شرف اختيارية: أعلى عشرة طلاب في النقاط» — §8. Sorted on balance in
     its own right and not from `rows`: the table's sort is a convenience for
     scanning, and an honour roll that reordered itself by name when he sorted
     by name would be the wrong ten students. A zero balance is not an honour,
     so a short list stays short. */
  const honour = useMemo(
    () => [...rows]
      .filter((r) => r.b.balance > 0)
      .sort((a, b) => b.b.balance - a.b.balance || a.s.fullName.localeCompare(b.s.fullName, 'ar'))
      .slice(0, 10),
    [rows]);

  const toggle = (id: string) =>
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const nameOf = (id: string) => db.students.find((s) => s.id === id)?.fullName ?? '—';

  if (!db.students.length) {
    return (
      <>
        <TopBar title="النقاط والمتجر" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا توجد أرصدة بعد"
              body="النقاط تُبنى على قائمة الطلاب. ارفع ملفاتك من الصفحة الرئيسية أولًا، ثم ابدأ الشحن."
              action={<Link href="/admin">
                <Btn variant="primary" size="lg" icon={Home}>الصفحة الرئيسية</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="النقاط والمتجر"
        crumbs={halaqa ? [`حلقة ${halaqa.teacher}`] : halaqaFilter === 'none' ? ['بلا حلقة'] : undefined}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/points/codes"><Btn icon={Ticket}>أكواد الشحن</Btn></Link>
            <Btn variant="primary" icon={Plus} onClick={() => setGranting(true)}>شحن نقاط</Btn>
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        {/* ── the four figures the ledger yields, for the current filter ──── */}
        <div className="rise mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI label="نقاط متداولة" value={totals.circulating} unit={pointWord(totals.circulating)} icon={Coins} accent
            sub={halaqa ? `في حلقة ${shortName(halaqa.teacher)}` : 'مجموع الأرصدة الحالية'} />
          <KPI label="إجمالي ما مُنح" value={totals.granted} unit={pointWord(totals.granted)} delay={60} />
          <KPI label="إجمالي ما استُبدل" value={totals.redeemed} unit={pointWord(totals.redeemed)} delay={120} />
          <KPI label="حركات مسجَّلة" value={totals.moves} delay={180}
            sub={`على ${rows.length} ${studentWord(rows.length)}`} />
        </div>

        {/* ── view switch + search ───────────────────────────────────────── */}
        <div className="rise mb-4 flex flex-wrap items-center gap-3">
          <Segmented<View> value={view} onChange={setView}
            options={[
              { value: 'BALANCES', label: 'الأرصدة' },
              { value: 'LEDGER', label: 'السجلّ', count: ledger.length },
              { value: 'HONOUR', label: 'لوحة الشرف' },
            ]} />
          <div className="relative min-w-[14rem] flex-1">
            <Search size={16} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={view === 'LEDGER' ? 'ابحث باسم الطالب أو السبب…' : 'ابحث بالاسم أو رقم الهوية…'}
              className={cx(INPUT, 'pe-10')} />
          </div>
          {sel.size > 0 && view === 'BALANCES' && (
            <div className="fade flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5">
              <span className="text-panel text-brand-800">حُدِّد <Num>{sel.size}</Num></span>
              <Btn size="sm" icon={Plus} onClick={() => setGranting(true)}>شحن للمحدَّدين</Btn>
              <button onClick={() => setSel(new Set())} className="rounded p-1 text-ink-400 hover:text-ink-800">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* ── الأرصدة ────────────────────────────────────────────────────── */}
        {view === 'BALANCES' && (
          <Sheet className="rise" pad={false}>
            {rows.length === 0 ? (
              <Empty icon={Coins} title="لا نتائج" body="جرّب توسيع التصفية أو مسح البحث." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-body">
                  <thead>
                    <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                      <th className="w-10 px-3 py-3">
                        <input type="checkbox" aria-label="تحديد الكل"
                          checked={sel.size === rows.length && rows.length > 0}
                          onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.s.id)) : new Set())}
                          className="h-4 w-4 rounded-sm border-ink-300 accent-brand-800" />
                      </th>
                      <SortHead label="الطالب" k="name" sort={sort} onSort={setSort} />
                      {!halaqa && <th className="px-3 py-3 text-start font-medium">الحلقة</th>}
                      <SortHead label="الرصيد" k="balance" sort={sort} onSort={setSort} align="end" />
                      <th className="px-3 py-3 text-start font-medium">مُنح</th>
                      <th className="px-3 py-3 text-start font-medium">استُبدل</th>
                      <SortHead label="آخر حركة" k="last" sort={sort} onSort={setSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ s, b }) => (
                      <tr key={s.id}
                        className={cx('border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50',
                          sel.has(s.id) && 'bg-brand-50')}>
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)}
                            aria-label={`تحديد ${s.fullName}`}
                            className="h-4 w-4 rounded-sm border-ink-300 accent-brand-800" />
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-medium text-ink-900">{s.fullName}</span>
                          {s.track === 'GOLDEN' && <> <Chip tone="warn">{TRACK_AR.GOLDEN}</Chip></>}
                        </td>
                        {!halaqa && (
                          <td className="px-3 py-3 text-panel text-ink-600"
                            title={db.halaqat.find((h) => h.id === s.halaqaId)?.teacher}>
                            {halaqaOf(s.halaqaId)}
                          </td>
                        )}
                        <td className="px-3 py-3 text-end">
                          <span className={cx('font-display text-lg2',
                            b.balance > 0 ? 'text-brand-800' : b.balance < 0 ? 'text-risk-700' : 'text-ink-400')}>
                            <Num>{b.balance}</Num>
                          </span>
                        </td>
                        <td className="px-3 py-3"><Num className="text-panel text-ok-700">{b.granted || '—'}</Num></td>
                        <td className="px-3 py-3"><Num className="text-panel text-ink-600">{b.redeemed || '—'}</Num></td>
                        <td className="px-3 py-3 text-panel text-ink-500" title={formatDateTime(b.lastAt)}>
                          {relativeDay(b.lastAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Sheet>
        )}

        {/* ── السجلّ — append-only, so a mistake is corrected, never erased ─ */}
        {view === 'LEDGER' && (
          <Sheet className="rise" pad={false}>
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-150 px-4 py-3">
              <span className="text-cap text-ink-500">نوع الحركة</span>
              <button onClick={() => setKindFilter('')}
                className={cx('rounded px-2 py-1 text-cap transition-colors',
                  !kindFilter ? 'bg-brand-100 font-medium text-brand-800' : 'text-ink-600 hover:bg-ink-100')}>
                الكل
              </button>
              {(Object.keys(TXN_KIND_AR) as TxnKind[]).map((k) => (
                <button key={k} onClick={() => setKindFilter(kindFilter === k ? '' : k)}
                  className={cx('rounded px-2 py-1 text-cap transition-colors',
                    kindFilter === k ? 'bg-brand-100 font-medium text-brand-800' : 'text-ink-600 hover:bg-ink-100')}>
                  {TXN_KIND_AR[k]}
                </button>
              ))}
            </div>

            {ledger.length === 0 ? (
              <Empty icon={Coins} title="لا حركات بعد"
                body="أول شحنة نقاط أو أول كود يُستبدل يظهر هنا، ولا يُحذف منه شيء أبدًا." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] border-collapse text-body">
                  <thead>
                    <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                      {['التاريخ', 'الطالب', 'النقاط', 'الحركة', 'السبب', 'بواسطة', ''].map((h) => (
                        <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((t) => (
                      <tr key={t.id} className="border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50">
                        <td className="whitespace-nowrap px-3 py-3">
                          <Num className="text-panel text-ink-600">{formatDateTime(t.createdAt)}</Num>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-ink-900">{nameOf(t.studentId)}</span>
                          <span className="mt-0.5 block text-micro text-ink-500">
                            {halaqaOf(db.students.find((s) => s.id === t.studentId)?.halaqaId ?? null)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={cx('font-medium', t.delta >= 0 ? 'text-ok-700' : 'text-risk-700')}>
                            <Num>{t.delta >= 0 ? `+${t.delta}` : t.delta}</Num>
                          </span>
                        </td>
                        <td className="px-3 py-3"><Chip tone={KIND_TONE[t.kind]}>{TXN_KIND_AR[t.kind]}</Chip></td>
                        <td className="px-3 py-3 text-panel text-ink-700">{t.reason}</td>
                        <td className="px-3 py-3 text-panel text-ink-500">{t.createdBy ?? 'الطالب'}</td>
                        <td className="px-3 py-3 text-end">
                          {t.kind !== 'CORRECTION' && (
                            <button onClick={() => { setCorrecting(t); setCorrectionNote(''); }}
                              title="تصحيح بحركة معاكسة" aria-label={`تصحيح حركة ${t.reason}`}
                              className="rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900">
                              <Undo2 size={14} strokeWidth={1.9} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Sheet>
        )}

        {/* ── لوحة الشرف — printed and pinned up in the halaqa ────────────── */}
        {view === 'HONOUR' && (
          <Sheet className="rise">
            <SheetHead title="أعلى عشرة في النقاط"
              meta={halaqa ? `حلقة ${halaqa.teacher}` : 'على مستوى الحلقات كلها'}
              action={
                <a href={`/print/honour${halaqa ? `?halaqa=${halaqa.id}` : ''}`} target="_blank" rel="noreferrer">
                  <Btn icon={Printer}>طباعة</Btn>
                </a>} />
            {honour.length === 0 ? (
              <Empty icon={Trophy} title="لا رصيد بعد"
                body="لوحة الشرف تظهر حين يملك الطلاب نقاطًا. ابدأ بشحن أول دفعة." />
            ) : (
              <ol className="divide-y divide-ink-150">
                {honour.map(({ s, b }, i) => (
                  <li key={s.id} className="flex items-center gap-4 py-3">
                    <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-body',
                      i === 0 ? 'bg-warn-100 text-warn-700'
                        : i < 3 ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600')}>
                      <Num>{i + 1}</Num>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base2 text-ink-900">{s.fullName}</span>
                      <span className="block text-micro text-ink-500">{halaqaOf(s.halaqaId)}</span>
                    </span>
                    <span className="font-display text-t1 text-brand-800"><Num>{b.balance}</Num></span>
                  </li>
                ))}
              </ol>
            )}
          </Sheet>
        )}

        {talqeenCount > 0 && (
          <p className="mt-4 text-panel text-ink-500">
            <Num className="font-medium text-ink-700">{talqeenCount}</Num> من طلاب التلقين خارج نظام النقاط والمتجر،
            فلا يظهرون هنا ولا تُسجَّل لهم حركة — القرار الأول في القسم ١٣ من الوثيقة.
          </p>
        )}
      </div>

      <GrantDialog open={granting} onClose={() => setGranting(false)}
        preselected={[...sel]} defaultHalaqa={halaqa?.id ?? null}
        onDone={() => setSel(new Set())} />

      {/* A correction is a new, opposite row. The original stays where it is —
          «لا تُحذف حركة أبدًا. إن أخطأت، تُضيف حركة تصحيح معاكسة». */}
      <Modal open={correcting !== null} onClose={() => setCorrecting(null)} title="تصحيح حركة"
        footer={
          <>
            <Btn onClick={() => setCorrecting(null)}>إلغاء</Btn>
            <Btn variant="primary"
              onClick={() => { if (correcting) store.correctTxn(correcting.id, correctionNote); setCorrecting(null); }}>
              تسجيل التصحيح
            </Btn>
          </>
        }>
        {correcting && (
          <div className="space-y-4">
            <p className="text-base2 text-ink-700">
              الحركة الأصلية تبقى في السجلّ كما هي، وتُضاف حركة معاكسة تلغي أثرها — فيبقى السجلّ صادقًا.
            </p>
            <div className="rounded-lg border border-ink-150 bg-page/50 px-3.5 py-3 text-panel">
              <p className="text-ink-900">{nameOf(correcting.studentId)}</p>
              <p className="mt-1 text-ink-600">
                <span className={correcting.delta >= 0 ? 'text-ok-700' : 'text-risk-700'}>
                  <Num>{correcting.delta >= 0 ? `+${correcting.delta}` : correcting.delta}</Num>
                </span>
                {' · '}{correcting.reason}{' · '}<Num>{formatDateTime(correcting.createdAt)}</Num>
              </p>
              <p className="mt-2 text-ink-700">
                سيُسجَّل الآن{' '}
                <span className={cx('font-medium', -correcting.delta >= 0 ? 'text-ok-700' : 'text-risk-700')}>
                  <Num>{-correcting.delta >= 0 ? `+${-correcting.delta}` : -correcting.delta}</Num>
                </span>{' '}{pointWord(Math.abs(correcting.delta))}.
              </p>
            </div>
            <Field label="سبب التصحيح" hint="اتركه فارغًا ليُكتب تلقائيًا من الحركة الأصلية">
              <input className={INPUT} value={correctionNote} autoFocus
                onChange={(e) => setCorrectionNote(e.target.value)} placeholder="مثال: شُحنت للطالب الخطأ" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

function SortHead({ label, k, sort, onSort, align = 'start' }:
  { label: string; k: SortKey; sort: SortKey; onSort: (k: SortKey) => void; align?: 'start' | 'end' }) {
  const on = sort === k;
  return (
    <th className={cx('px-3 py-3 font-medium', align === 'end' ? 'text-end' : 'text-start')}>
      <button onClick={() => onSort(k)}
        className={cx('inline-flex items-center gap-1 rounded transition-colors hover:text-ink-900',
          on && 'font-bold text-brand-800')}>
        {label}
        <ArrowDownUp size={12} strokeWidth={2} className={cx(on ? 'opacity-100' : 'opacity-35')} />
      </button>
    </th>
  );
}

export default function Page() {
  return <Suspense><PointsScreen /></Suspense>;
}
