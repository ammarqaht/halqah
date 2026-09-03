'use client';
/* The panel for النقاط والمتجر — DESIGN.md §4, which specifies exactly this:
   «Batch list / gift categories / order status».

   One section, three screens, and the panel re-tools for each: over the
   balances it is the halaqa filter, over the cards it is the batch list, over
   the store it is the categories and the order queue. The supervisor filters
   without ever leaving his results. */
import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { BatchDialog } from '@/components/BatchDialog';
import { Num, studentWord, pointWord } from '@/components/Num';
import { useDB } from '@/lib/store';
import { balances, earnsPoints, batchState, isLowStock, BATCH_STATE_AR } from '@/lib/points';
import { ORDER_STATUS_AR, type OrderStatus } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

export function PointsPanel({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const path = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const [issuing, setIssuing] = useState(false);

  const onCodes = path.startsWith('/admin/points/codes');
  const onStore = path.startsWith('/admin/store');
  const onBalances = !onCodes && !onStore;

  const set = (key: string, val: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (val === null || next.get(key) === val) next.delete(key); else next.set(key, val);
    router.replace(`${path}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  /* Only students who can hold points are counted here. Showing a halaqa's full
     head-count next to a balances table that excludes Talqeen would make the
     two figures disagree on the same screen. */
  const counts = useMemo(() => {
    const byHalaqa = new Map<string, number>();
    let orphan = 0;
    let talqeen = 0;
    for (const s of db.students) {
      if (!earnsPoints(s)) { talqeen++; continue; }
      if (s.halaqaId) byHalaqa.set(s.halaqaId, (byHalaqa.get(s.halaqaId) ?? 0) + 1); else orphan++;
    }
    return { byHalaqa, orphan, talqeen, eligible: db.students.length - talqeen };
  }, [db.students]);

  const bal = useMemo(() => balances(db.txns), [db.txns]);
  const circulating = useMemo(
    () => [...bal.values()].reduce((sum, b) => sum + b.balance, 0), [bal]);

  const batchRows = useMemo(() => db.batches.map((b) => {
    const codes = db.codes.filter((c) => c.batchId === b.id);
    const used = codes.filter((c) => c.redeemedBy).length;
    return { batch: b, used, remaining: codes.length - used, state: batchState(b, codes.length - used) };
  }).sort((a, b) => (a.batch.createdAt < b.batch.createdAt ? 1 : -1)), [db.batches, db.codes]);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of db.gifts) if (g.category) m.set(g.category, (m.get(g.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [db.gifts]);

  const orderCounts = useMemo(() => {
    const m = new Map<OrderStatus, number>();
    for (const o of db.orders) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return m;
  }, [db.orders]);

  const lowStock = useMemo(() => db.gifts.filter(isLowStock).length, [db.gifts]);
  const pending = orderCounts.get('PENDING') ?? 0;

  const halaqa = sp.get('halaqa');
  const batch = sp.get('batch');
  const category = sp.get('category');
  const status = sp.get('status');

  return (
    <>
      <PanelShell title="النقاط والمتجر"
        meta={db.students.length
          ? `${circulating} ${pointWord(circulating)} متداولة · ${counts.eligible} ${studentWord(counts.eligible)}`
          : 'لا توجد بيانات بعد'}
        onClose={onClose}>

        <PanelGroup label="الشاشات">
          <PanelItem active={onBalances} onClick={() => router.push('/admin/points')}>
            الأرصدة والسجلّ
          </PanelItem>
          <PanelItem active={onCodes} onClick={() => router.push('/admin/points/codes')}
            count={batchRows.length || undefined}>أكواد الشحن</PanelItem>
          <PanelItem active={onStore} onClick={() => router.push('/admin/store')}
            count={db.gifts.length || undefined}
            tone={pending > 0 && !onStore ? 'warn' : undefined}>المتجر</PanelItem>
        </PanelGroup>

        {onStore && (
          <>
            <PanelGroup label="الطلبات">
              <PanelItem active={!status} onClick={() => set('status', null)} count={db.orders.length}>
                كل الطلبات
              </PanelItem>
              {(['PENDING', 'DELIVERED', 'CANCELLED'] as OrderStatus[]).map((s) => {
                const n = orderCounts.get(s) ?? 0;
                if (!n) return null;
                return (
                  <PanelItem key={s} active={status === s} onClick={() => set('status', s)} count={n}
                    tone={s === 'PENDING' ? 'warn' : s === 'DELIVERED' ? 'ok' : 'risk'}>
                    {ORDER_STATUS_AR[s]}
                  </PanelItem>
                );
              })}
            </PanelGroup>

            {categories.length > 0 && (
              <PanelGroup label="تصنيف الهدايا">
                <PanelItem active={!category} onClick={() => set('category', null)} count={db.gifts.length}>
                  كل الهدايا
                </PanelItem>
                {categories.map(([c, n]) => (
                  <PanelItem key={c} active={category === c} onClick={() => set('category', c)} count={n}>
                    {c}
                  </PanelItem>
                ))}
              </PanelGroup>
            )}

            {lowStock > 0 && (
              <p className="mt-1 rounded-md bg-warn-100 px-2.5 py-2 text-micro leading-relaxed text-warn-700">
                <Num className="font-medium">{lowStock}</Num> من الهدايا بلغت حدّ التنبيه. راجع كمياتها.
              </p>
            )}
          </>
        )}

        {onCodes && (
          <PanelGroup label="الدفعات">
            <button onClick={() => setIssuing(true)}
              className="mb-1.5 flex w-full items-center gap-2 rounded-md border border-dashed border-ink-300 px-2 py-2 text-panel text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800">
              <Plus size={15} strokeWidth={2} /> إصدار دفعة
            </button>

            {batchRows.length === 0 ? (
              <p className="px-1.5 py-2 text-panel leading-relaxed text-ink-500">
                لم تُصدر دفعة بعد. البطاقة الواحدة تُشحن مرة واحدة فقط.
              </p>
            ) : (
              <>
                <PanelItem active={!batch} onClick={() => set('batch', null)} count={batchRows.length}>
                  كل الدفعات
                </PanelItem>
                {batchRows.map(({ batch: b, remaining, state }) => (
                  <PanelItem key={b.id} active={batch === b.id} onClick={() => set('batch', b.id)}
                    count={remaining}
                    tone={state === 'REVOKED' ? 'risk' : state === 'EXPIRED' ? 'warn' : undefined}
                    sub={state === 'ACTIVE' ? `${b.purpose} · متبقٍ` : `${b.purpose} · ${BATCH_STATE_AR[state]}`}>
                    <span className={cx(state !== 'ACTIVE' && 'text-ink-500')}>
                      <Num>{b.value}</Num> {pointWord(b.value)}
                    </span>
                  </PanelItem>
                ))}
              </>
            )}
          </PanelGroup>
        )}

        {onBalances && (
          <PanelGroup label="الحلقات">
            <PanelItem active={!halaqa} onClick={() => set('halaqa', null)} count={counts.eligible}>
              كل الطلاب
            </PanelItem>
            {db.halaqat.map((h) => (
              <PanelItem key={h.id} active={halaqa === h.id} onClick={() => set('halaqa', h.id)}
                count={counts.byHalaqa.get(h.id) ?? 0} sub={h.timeSlot}>
                {shortName(h.teacher)}
              </PanelItem>
            ))}
            {counts.orphan > 0 && (
              <PanelItem tone="risk" active={halaqa === 'none'} onClick={() => set('halaqa', 'none')}
                count={counts.orphan}>بلا حلقة</PanelItem>
            )}
          </PanelGroup>
        )}

        {counts.talqeen > 0 && !onStore && (
          <p className="mt-1 rounded-md bg-page px-2.5 py-2 text-micro leading-relaxed text-ink-500">
            <Num className="font-medium text-ink-700">{counts.talqeen}</Num> من طلاب التلقين خارج نظام النقاط،
            فلا يظهرون في هذه الشاشة.
          </p>
        )}
      </PanelShell>

      <BatchDialog open={issuing} onClose={() => setIssuing(false)}
        onIssued={(id) => window.open(`/print/codes/${id}`, '_blank')} />
    </>
  );
}
