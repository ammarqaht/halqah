'use client';
/* أكواد الشحن — SPEC.md §6.5, approved PDF §8 (إد-٤-ب).
   This screen replaces a physical ritual, described by the client in his own
   words: «أطبع نقاط تحفيز — أوراق الباركود … أوزّعهم على الحلقات كل يوم، فيعطي
   المعلّم الطالب الورقة لمّا يسمّع أو يحضر، والطالب يشحنها». We move it as it
   is: issue, print, hand out, redeem once — and keep a way to kill a batch that
   was lost before the cards on it are spent.

   Selecting a batch turns the page into that batch's file, the same way
   selecting a halaqa does on the roster (SPEC.md §6.2). */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Ticket, Plus, Printer, Ban, Inbox, Search, Coins, ChevronLeft, AlertTriangle,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty, Chip, Modal, INPUT } from '@/components/ui';
import { KPI } from '@/components/Stat';
import { Num, cardWord, pointWord } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { BatchDialog } from '@/components/BatchDialog';
import { store, useDB } from '@/lib/store';
import {
  batchState, cardColour, codeState, formatCode, BATCH_STATE_AR,
  type BatchState,
} from '@/lib/points';
import type { PointCodeBatch } from '@/lib/types';
import { foldArabic } from '@/lib/normalise';
import { formatDate, formatDateTime } from '@/lib/dates';
import { cx } from '@/lib/cx';

const STATE_TONE: Record<BatchState, 'ok' | 'warn' | 'risk' | 'ink'> = {
  ACTIVE: 'ok', EXPIRED: 'warn', REVOKED: 'risk', SPENT: 'ink',
};

function CodesScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState<PointCodeBatch | null>(null);
  const [q, setQ] = useState('');

  const batchId = sp.get('batch');
  const filterKey = sp.toString();
  useEffect(() => { setRevoking(null); setQ(''); }, [filterKey]);

  const rows = useMemo(() => db.batches.map((b) => {
    const codes = db.codes.filter((c) => c.batchId === b.id);
    const used = codes.filter((c) => c.redeemedBy).length;
    const remaining = codes.length - used;
    return { b, codes, used, remaining, state: batchState(b, remaining) };
  }).sort((x, y) => (x.b.createdAt < y.b.createdAt ? 1 : -1)), [db.batches, db.codes]);

  const open = batchId ? rows.find((r) => r.b.id === batchId) ?? null : null;

  const totals = useMemo(() => rows.reduce((a, r) => ({
    batches: a.batches + 1,
    issued: a.issued + r.codes.length,
    used: a.used + r.used,
    /* Only what a live batch can still pay out. A revoked or expired batch has
       cards left on paper, but none of them is worth a point any more. */
    outstanding: a.outstanding + (r.state === 'ACTIVE' ? r.remaining * r.b.value : 0),
  }), { batches: 0, issued: 0, used: 0, outstanding: 0 }), [rows]);

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const s = db.students.find((x) => x.id === id);
    return s ? s.fullName : 'طالب محذوف';
  };

  const openCodes = useMemo(() => {
    if (!open) return [];
    const needle = foldArabic(q);
    return open.codes.filter((c) => {
      if (!needle) return true;
      return c.code.includes(q.trim().toUpperCase())
        || foldArabic(nameOf(c.redeemedBy) ?? '').includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q, db.students]);

  return (
    <>
      <TopBar title="أكواد الشحن"
        crumbs={open ? ['النقاط والمتجر', `دفعة ${open.b.value} ${pointWord(open.b.value)}`] : ['النقاط والمتجر']}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/points"><Btn icon={Coins}>الأرصدة</Btn></Link>
            <Btn variant="primary" icon={Plus} onClick={() => setIssuing(true)}>إصدار دفعة</Btn>
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        {db.batches.length === 0 ? (
          <Sheet className="rise">
            <Empty icon={Inbox} title="لم تُصدر دفعة بعد"
              body="حدّد قيمة الكود وعدد البطاقات والغرض، فيولّد النظام أرقامًا عشوائية غير متسلسلة، ويخرج لك ملفًا جاهزًا للطباعة والقصّ."
              action={<Btn variant="primary" size="lg" icon={Plus} onClick={() => setIssuing(true)}>إصدار دفعة</Btn>} />
          </Sheet>
        ) : open ? (
          /* ── a single batch's file ───────────────────────────────────── */
          <>
            <button onClick={() => router.replace('/admin/points/codes')}
              className="rise mb-4 inline-flex items-center gap-1 text-panel text-ink-500 transition-colors hover:text-brand-800">
              <ChevronLeft size={15} /> كل الدفعات
            </button>

            <Sheet className="rise mb-4 border-brand-200 bg-brand-50/50">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-micro uppercase tracking-[.12em] text-brand-800">دفعة أكواد</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-t1 text-ink-900">
                      <Num>{open.b.value}</Num> {pointWord(open.b.value)} · {open.b.purpose}
                    </h2>
                    <Chip tone={STATE_TONE[open.state]}>{BATCH_STATE_AR[open.state]}</Chip>
                  </div>
                  <p className="mt-1.5 text-panel text-ink-600">
                    صدرت <Num>{formatDate(open.b.createdAt)}</Num>
                    {open.b.expiresAt && <> · تنتهي <Num>{formatDate(open.b.expiresAt)}</Num></>}
                    {open.b.revokedAt && <> · أُلغيت <Num>{formatDate(open.b.revokedAt)}</Num></>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/print/codes/${open.b.id}`} target="_blank" rel="noreferrer">
                    <Btn icon={Printer}>طباعة البطاقات</Btn>
                  </a>
                  {!open.b.revokedAt && (
                    <Btn variant="danger" icon={Ban} onClick={() => setRevoking(open.b)}>إلغاء الدفعة</Btn>
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-4">
                {[
                  { l: 'بطاقة', v: open.codes.length },
                  { l: 'استُخدمت', v: open.used },
                  { l: 'متبقية', v: open.remaining },
                ].map((k) => (
                  <div key={k.l} className="rounded-xl border border-ink-150 bg-page/40 p-4">
                    <p className="text-xs2 text-ink-600">{k.l}</p>
                    <p className="mt-1.5 font-display text-d2 text-ink-900"><Num>{k.v}</Num></p>
                  </div>
                ))}
              </div>
            </Sheet>

            <div className="rise mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[14rem] flex-1">
                <Search size={16} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-ink-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث برقم الكود أو باسم من شحنه…" className={cx(INPUT, 'pe-10')} />
              </div>
              <span className="text-panel text-ink-500">
                <Num className="font-medium text-ink-900">{openCodes.length}</Num> من <Num>{open.codes.length}</Num>
              </span>
            </div>

            <Sheet className="rise" pad={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] border-collapse text-body">
                  <thead>
                    <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                      {['الكود', 'الحالة', 'من شحنه', 'متى'].map((h) => (
                        <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {openCodes.map((c) => {
                      const st = codeState(c, open.b);
                      return (
                        <tr key={c.id} className="border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50">
                          <td className="px-3 py-3">
                            <Num className={cx('font-medium tracking-wider',
                              st === 'OK' ? 'text-ink-900' : 'text-ink-400 line-through')}>
                              {formatCode(c.code)}
                            </Num>
                          </td>
                          <td className="px-3 py-3">
                            <Chip tone={st === 'OK' ? 'ok' : st === 'USED' ? 'ink' : st === 'EXPIRED' ? 'warn' : 'risk'}>
                              {st === 'OK' ? 'صالحة' : st === 'USED' ? 'شُحنت' : st === 'EXPIRED' ? 'منتهية' : 'ملغاة'}
                            </Chip>
                          </td>
                          <td className="px-3 py-3 text-panel text-ink-700">{nameOf(c.redeemedBy) ?? '—'}</td>
                          <td className="px-3 py-3 text-panel text-ink-500">
                            {c.redeemedAt ? <Num>{formatDateTime(c.redeemedAt)}</Num> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Sheet>
          </>
        ) : (
          /* ── all batches ─────────────────────────────────────────────── */
          <>
            <div className="rise mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KPI label="دفعات" value={totals.batches} icon={Ticket} accent />
              <KPI label="بطاقات مُصدرة" value={totals.issued} delay={60} />
              <KPI label="بطاقات شُحنت" value={totals.used} delay={120} />
              <KPI label="نقاط لم تُصرف بعد" value={totals.outstanding} unit="نقطة" delay={180}
                sub="في بطاقات سارية بأيدي المعلّمين" />
            </div>

            <Sheet className="rise" pad={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] border-collapse text-body">
                  <thead>
                    <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                      {['الدفعة', 'الغرض', 'العدد', 'استُخدم', 'متبقٍ', 'الانتهاء', 'الحالة', ''].map((h) => (
                        <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ b, codes, used, remaining, state }) => {
                      const colour = cardColour(b.value);
                      return (
                        <tr key={b.id} className="border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50">
                          <td className="px-3 py-3">
                            <button onClick={() => router.replace(`/admin/points/codes?batch=${b.id}`)}
                              className="flex items-center gap-2.5 text-start">
                              <span className="h-7 w-7 shrink-0 rounded-md border"
                                style={{ background: colour.wash, borderColor: colour.rule }} />
                              <span>
                                <span className="block font-medium text-ink-900">
                                  <Num>{b.value}</Num> {pointWord(b.value)}
                                </span>
                                <span className="block text-micro text-ink-500">
                                  <Num>{formatDate(b.createdAt)}</Num>
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-3 text-panel text-ink-600">{b.purpose}</td>
                          <td className="px-3 py-3"><Num className="text-panel text-ink-700">{codes.length}</Num></td>
                          <td className="px-3 py-3"><Num className="text-panel text-ok-700">{used || '—'}</Num></td>
                          <td className="px-3 py-3"><Num className="text-panel font-medium text-ink-900">{remaining}</Num></td>
                          <td className="px-3 py-3 text-panel text-ink-500">
                            {b.expiresAt ? <Num>{formatDate(b.expiresAt)}</Num> : 'بلا انتهاء'}
                          </td>
                          <td className="px-3 py-3"><Chip tone={STATE_TONE[state]}>{BATCH_STATE_AR[state]}</Chip></td>
                          <td className="px-3 py-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <a href={`/print/codes/${b.id}`} target="_blank" rel="noreferrer"
                                title="طباعة البطاقات" aria-label={`طباعة بطاقات دفعة ${b.value} ${pointWord(b.value)}`}
                                className="rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900">
                                <Printer size={14} strokeWidth={1.9} />
                              </a>
                              {!b.revokedAt && (
                                <button onClick={() => setRevoking(b)}
                                  title="إلغاء الدفعة" aria-label={`إلغاء دفعة ${b.value} ${pointWord(b.value)}`}
                                  className="rounded p-1.5 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700">
                                  <Ban size={14} strokeWidth={1.9} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Sheet>

            <p className="mt-4 text-panel text-ink-500">
              كل بطاقة تعمل مرة واحدة فقط. إلغاء دفعة يوقف بطاقاتها غير المستعملة فورًا،
              ولا يمسّ نقاطًا شُحنت من قبل — الطالب لم يخطئ.
            </p>
          </>
        )}
      </div>

      <BatchDialog open={issuing} onClose={() => setIssuing(false)}
        onIssued={(id) => window.open(`/print/codes/${id}`, '_blank')} />

      <Modal open={revoking !== null} onClose={() => setRevoking(null)} title="إلغاء دفعة"
        footer={
          <>
            <Btn onClick={() => setRevoking(null)}>تراجع</Btn>
            <Btn variant="danger"
              onClick={() => { if (revoking) store.revokeBatch(revoking.id); setRevoking(null); }}>
              إلغاء الدفعة
            </Btn>
          </>
        }>
        {revoking && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-risk-700" />
              <p className="text-panel text-risk-700">
                ستتوقف فورًا{' '}
                <Num className="font-medium">
                  {db.codes.filter((c) => c.batchId === revoking.id && !c.redeemedBy).length}
                </Num>{' '}{cardWord(db.codes.filter((c) => c.batchId === revoking.id && !c.redeemedBy).length)} غير مستعملة من هذه الدفعة، ولن تُقبل بعد الآن.
              </p>
            </div>
            <p className="text-base2 text-ink-700">
              النقاط التي شُحنت من هذه الدفعة قبل الإلغاء تبقى في أرصدة الطلاب كما هي.
              الإلغاء لا يُلغى، فاستعمله حين تضيع الأوراق أو تتسرّب فقط.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function Page() {
  return <Suspense><CodesScreen /></Suspense>;
}
