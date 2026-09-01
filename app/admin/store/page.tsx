'use client';
/* المتجر — SPEC.md §6.6, approved PDF §8 (إد-٤-ج).
   «الغرض: إدارة الهدايا وقيمها وكمياتها، ومتابعة ما اشتراه الطلاب» — so two
   views, because those are two jobs: the catalogue he maintains once a term,
   and the orders he works through after every circle.

   Gifts render as cards rather than rows. The catalogue is short, it is
   pictorial by nature, and the supervisor recognises a gift by its photograph
   long before he reads its name. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Gift as GiftIcon, Plus, Search, Package, Printer, Coins, Eye, EyeOff, Pencil, Check, X,
  AlertTriangle, PackageOpen,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Modal, Field, INPUT, Segmented } from '@/components/ui';
import { KPI } from '@/components/Stat';
import { Num, studentWord, pointWord } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { GiftDialog } from '@/components/GiftDialog';
import { PurchaseDialog } from '@/components/PurchaseDialog';
import { store, useDB } from '@/lib/store';
import { balances, isLowStock, EMPTY_BALANCE } from '@/lib/points';
import { GIFT_STATUS_AR, ORDER_STATUS_AR, type Gift, type Order, type OrderStatus } from '@/lib/types';
import { foldArabic, shortName } from '@/lib/normalise';
import { formatDateTime, relativeDay } from '@/lib/dates';
import { cx } from '@/lib/cx';

type View = 'GIFTS' | 'ORDERS';

const ORDER_TONE: Record<OrderStatus, 'warn' | 'ok' | 'risk'> = {
  PENDING: 'warn', DELIVERED: 'ok', CANCELLED: 'risk',
};

function StoreScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const [view, setView] = useState<View>('GIFTS');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Gift | 'new' | null>(null);
  const [buying, setBuying] = useState<string | null | false>(false);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const category = sp.get('category');
  const orderStatus = sp.get('status') as OrderStatus | null;

  const filterKey = sp.toString();
  useEffect(() => { setEditing(null); setBuying(false); setCancelling(null); }, [filterKey]);

  /* The orders panel and the gifts panel are different filters; landing on the
     screen with a status filter means the supervisor came here for orders. */
  useEffect(() => { if (orderStatus) setView('ORDERS'); }, [orderStatus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const bal = useMemo(() => balances(db.txns), [db.txns]);

  const gifts = useMemo(() => {
    const needle = foldArabic(q);
    return db.gifts.filter((g) => {
      if (category && g.category !== category) return false;
      if (needle && !foldArabic(g.name).includes(needle) && !foldArabic(g.description).includes(needle)) return false;
      return true;
    }).sort((a, b) => a.pointsCost - b.pointsCost);
  }, [db.gifts, category, q]);

  const orders = useMemo(() => {
    const needle = foldArabic(q);
    return db.orders.filter((o) => {
      if (orderStatus && o.status !== orderStatus) return false;
      if (needle) {
        const s = db.students.find((x) => x.id === o.studentId);
        if (!foldArabic(s?.fullName ?? '').includes(needle)
          && !foldArabic(o.giftNameSnapshot).includes(needle)
          && !String(o.number).includes(q.trim())) return false;
      }
      return true;
    }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [db.orders, db.students, orderStatus, q]);

  const totals = useMemo(() => ({
    gifts: db.gifts.length,
    visible: db.gifts.filter((g) => g.status === 'VISIBLE').length,
    lowStock: db.gifts.filter(isLowStock).length,
    outOfStock: db.gifts.filter((g) => g.status === 'VISIBLE' && g.quantity <= 0).length,
    pending: db.orders.filter((o) => o.status === 'PENDING').length,
    spent: db.orders.filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.pointsSpent, 0),
  }), [db.gifts, db.orders]);

  const studentOf = (id: string) => db.students.find((s) => s.id === id) ?? null;
  const halaqaOf = (studentId: string) => {
    const s = studentOf(studentId);
    const t = s?.halaqaId ? db.halaqat.find((h) => h.id === s.halaqaId)?.teacher : null;
    return t ? shortName(t) : '—';
  };

  if (!db.gifts.length && !db.orders.length) {
    return (
      <>
        <TopBar title="المتجر" crumbs={['النقاط والمتجر']} panelOpen={panelOpen}
          onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={PackageOpen} title="المتجر فارغ"
              body="أضف أول هدية باسمها وصورتها وقيمتها بالنقاط وكميتها. ما نفدت كميته يظهر للطالب «غير متوفّر»، وما أخفيته يبقى محفوظًا حتى تعيده."
              action={<Btn variant="primary" size="lg" icon={Plus} onClick={() => setEditing('new')}>إضافة هدية</Btn>} />
          </Sheet>
        </div>
        <GiftDialog open={editing !== null} gift={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)} />
      </>
    );
  }

  return (
    <>
      <TopBar title="المتجر"
        crumbs={['النقاط والمتجر', ...(category ? [category] : [])]}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/points"><Btn icon={Coins}>الأرصدة</Btn></Link>
            <Btn icon={GiftIcon} onClick={() => setBuying(null)}>صرف هدية</Btn>
            <Btn variant="primary" icon={Plus} onClick={() => setEditing('new')}>إضافة هدية</Btn>
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        <div className="rise mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI label="طلبات بانتظار التسليم" value={totals.pending} icon={Package} accent
            sub={totals.pending ? 'اطبع قائمة التسليم ووزّعها' : 'لا شيء معلّق'} />
          <KPI label="هدايا معروضة" value={totals.visible} delay={60}
            sub={totals.gifts !== totals.visible ? `من ${totals.gifts} في الكتالوج` : undefined} />
          <KPI label="قاربت على النفاد" value={totals.lowStock} delay={120}
            sub={totals.outOfStock ? `و${totals.outOfStock} نفدت تمامًا` : 'دون حدّ التنبيه'} />
          <KPI label="نقاط استُبدلت بهدايا" value={totals.spent} unit={pointWord(totals.spent)} delay={180} />
        </div>

        <div className="rise mb-4 flex flex-wrap items-center gap-3">
          <Segmented<View> value={view} onChange={setView}
            options={[
              { value: 'GIFTS', label: 'الهدايا', count: gifts.length },
              { value: 'ORDERS', label: 'الطلبات', count: orders.length },
            ]} />
          <div className="relative min-w-[14rem] flex-1">
            <Search size={16} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={view === 'GIFTS' ? 'ابحث باسم الهدية…' : 'ابحث بالطالب أو الهدية أو رقم الطلب…'}
              className={cx(INPUT, 'pe-10')} />
          </div>
          {view === 'ORDERS' && totals.pending > 0 && (
            <a href="/print/pick-list" target="_blank" rel="noreferrer">
              <Btn icon={Printer}>قائمة التسليم</Btn>
            </a>
          )}
        </div>

        {/* ── الهدايا ────────────────────────────────────────────────────── */}
        {view === 'GIFTS' && (
          gifts.length === 0 ? (
            <Sheet className="rise">
              <Empty icon={GiftIcon} title="لا هدايا في هذا التصنيف"
                body="جرّب تصنيفًا آخر أو امسح البحث." />
            </Sheet>
          ) : (
            <div className="rise grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gifts.map((g) => {
                const low = isLowStock(g);
                const out = g.quantity <= 0;
                return (
                  <article key={g.id}
                    className={cx('flex flex-col overflow-hidden rounded-xl border bg-paper shadow-card transition-shadow hover:shadow-soft',
                      g.status === 'HIDDEN' ? 'border-ink-200 opacity-70' : 'border-ink-150')}>
                    {/* The image stays a large click target for editing, but it is
                        no longer the ONLY one: an affordance you have to guess at
                        is not an affordance, so a labelled pencil sits below.

                        That makes this one a *duplicate* of a control already
                        exposed properly — so it is taken out of the tab order and
                        hidden from assistive tech. Two buttons announcing
                        «تعديل حقيبة مدرسية» is a worse screen-reader experience
                        than one, and the pencil is the one with the better name. */}
                    <button onClick={() => setEditing(g)} className="block text-start"
                      tabIndex={-1} aria-hidden="true">
                      <div className="relative flex aspect-[4/3] items-center justify-center bg-page">
                        {g.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={g.image} alt={g.name}
                            className={cx('h-full w-full object-cover transition-[filter,opacity] duration-200',
                              g.status === 'HIDDEN' && 'grayscale')} />
                        ) : (
                          <GiftIcon size={30} strokeWidth={1.4} className="text-ink-300" />
                        )}
                        <span className="absolute end-2 top-2 flex flex-col items-end gap-1">
                          {g.status === 'HIDDEN' && (
                            <Chip tone="ink"><EyeOff size={10} />{GIFT_STATUS_AR.HIDDEN}</Chip>
                          )}
                          {out ? <Chip tone="risk">نفدت</Chip>
                            : low ? <Chip tone="warn">قاربت على النفاد</Chip> : null}
                        </span>
                      </div>
                    </button>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 flex-1 truncate font-medium text-ink-900">{g.name}</h3>
                        <span className="shrink-0 font-display text-lg2 text-brand-800">
                          <Num>{g.pointsCost}</Num>
                        </span>
                      </div>
                      {g.description && (
                        <p className="mt-1 line-clamp-2 text-panel text-ink-600">{g.description}</p>
                      )}
                      <p className="mt-3 text-panel text-ink-500">
                        {g.category} · متوفّر{' '}
                        <Num className={cx('font-medium', out ? 'text-risk-700' : low ? 'text-warn-700' : 'text-ink-800')}>
                          {g.quantity}
                        </Num>
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-150 pt-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing(g)}
                            title="تعديل التفاصيل والصورة والكمية" aria-label={`تعديل ${g.name}`}
                            className="rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900">
                            <Pencil size={16} strokeWidth={1.9} />
                          </button>

                          {/* One tap, no dialog. Hiding is reversible and frequent —
                              the gift ran out, it comes back next month — so it
                              should cost a tap, not a form. The eye states which
                              way the tap goes: open eye ⇒ the student sees it. */}
                          <button
                            onClick={() => {
                              const next = g.status === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE';
                              store.upsertGift({ ...g, status: next });
                              setToast(next === 'HIDDEN'
                                ? `أُخفيت «${g.name}» عن الطلاب.`
                                : `عادت «${g.name}» إلى متجر الطلاب.`);
                            }}
                            title={g.status === 'VISIBLE' ? 'إخفاء عن الطلاب' : 'إظهار للطلاب'}
                            aria-label={g.status === 'VISIBLE' ? `إخفاء ${g.name} عن الطلاب` : `إظهار ${g.name} للطلاب`}
                            aria-pressed={g.status === 'HIDDEN'}
                            className={cx('rounded-md p-2 transition-colors',
                              g.status === 'VISIBLE'
                                ? 'text-brand-800 hover:bg-brand-100'
                                : 'bg-ink-100 text-ink-500 hover:bg-ink-150 hover:text-ink-800')}>
                            {g.status === 'VISIBLE'
                              ? <Eye size={16} strokeWidth={1.9} />
                              : <EyeOff size={16} strokeWidth={1.9} />}
                          </button>
                        </div>

                        <Btn size="sm" icon={GiftIcon} disabled={out || g.status === 'HIDDEN'}
                          title={out ? 'نفدت الكمية' : g.status === 'HIDDEN' ? 'الهدية مخفيّة عن الطلاب' : undefined}
                          onClick={() => setBuying(g.id)}>صرف</Btn>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        )}

        {/* ── الطلبات ────────────────────────────────────────────────────── */}
        {view === 'ORDERS' && (
          <Sheet className="rise" pad={false}>
            {orders.length === 0 ? (
              <Empty icon={Package} title="لا طلبات بعد"
                body="حين يشتري طالب هدية — من بوابته أو بصرفها له من هنا — يظهر الطلب في هذا الجدول برقمه." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[50rem] border-collapse text-body">
                  <thead>
                    <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                      {['رقم الطلب', 'الطالب', 'الحلقة', 'الهدية', 'النقاط', 'التاريخ', 'الحالة', ''].map((h) => (
                        <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const s = studentOf(o.studentId);
                      return (
                        <tr key={o.id} className="border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50">
                          <td className="px-3 py-3">
                            <Num className="font-display text-lg2 text-ink-900">{o.number}</Num>
                          </td>
                          <td className="px-3 py-3 text-ink-900">{s?.fullName ?? '—'}</td>
                          <td className="px-3 py-3 text-panel text-ink-600">{halaqaOf(o.studentId)}</td>
                          <td className="px-3 py-3 text-panel text-ink-700">{o.giftNameSnapshot}</td>
                          <td className="px-3 py-3">
                            <Num className="font-medium text-risk-700">−{o.pointsSpent}</Num>
                          </td>
                          <td className="px-3 py-3 text-panel text-ink-500" title={formatDateTime(o.createdAt)}>
                            {relativeDay(o.createdAt)}
                          </td>
                          <td className="px-3 py-3">
                            <Chip tone={ORDER_TONE[o.status]}>{ORDER_STATUS_AR[o.status]}</Chip>
                            {o.cancelledReason && (
                              <span className="mt-0.5 block max-w-[12rem] truncate text-micro text-ink-500"
                                title={o.cancelledReason}>{o.cancelledReason}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-end">
                            {o.status === 'PENDING' && (
                              <div className="flex items-center justify-end gap-1">
                                <Btn size="sm" icon={Check} onClick={() => {
                                  store.deliverOrder(o.id);
                                  setToast(`سُلِّم الطلب رقم ${o.number}.`);
                                }}>تم التسليم</Btn>
                                <button onClick={() => { setCancelling(o); setCancelReason(''); }}
                                  title="إلغاء الطلب" aria-label={`إلغاء الطلب رقم ${o.number}`}
                                  className="rounded p-1.5 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700">
                                  <X size={15} strokeWidth={2} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Sheet>
        )}
      </div>

      {toast && (
        <div role="status"
          className="fade fixed bottom-6 start-1/2 z-[70] -translate-x-1/2 rounded-lg bg-brand-900 px-4 py-2.5 text-body text-white shadow-pop">
          {toast}
        </div>
      )}

      <GiftDialog open={editing !== null} gift={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)} />

      <PurchaseDialog open={buying !== false} defaultGift={buying || null}
        onClose={() => setBuying(false)}
        onDone={(n) => setToast(`سُجِّل الطلب رقم ${n} بانتظار التسليم.`)} />

      {/* Cancelling gives back both halves — points and stock — and says why. */}
      <Modal open={cancelling !== null} onClose={() => setCancelling(null)} title="إلغاء الطلب"
        footer={
          <>
            <Btn onClick={() => setCancelling(null)}>تراجع</Btn>
            <Btn variant="danger" onClick={() => {
              if (cancelling) {
                store.cancelOrder(cancelling.id, cancelReason);
                setToast(`أُلغي الطلب رقم ${cancelling.number} وأُعيدت نقاطه.`);
              }
              setCancelling(null);
            }}>إلغاء الطلب</Btn>
          </>
        }>
        {cancelling && (
          <div className="space-y-4">
            <div className="rounded-lg border border-ink-150 bg-page/50 px-3.5 py-3 text-panel">
              <p className="text-ink-900">
                طلب رقم <Num className="font-medium">{cancelling.number}</Num> — {cancelling.giftNameSnapshot}
              </p>
              <p className="mt-1 text-ink-600">
                {studentOf(cancelling.studentId)?.fullName ?? '—'} · {halaqaOf(cancelling.studentId)}
              </p>
            </div>
            <p className="rounded-lg bg-ok-100 px-3.5 py-3 text-base2 text-ok-700">
              ستُعاد <Num className="font-medium">{cancelling.pointsSpent}</Num> {pointWord(cancelling.pointsSpent)} إلى رصيد الطالب،
              وتُعاد الكمية إلى المخزون. الطلب يبقى في السجلّ ملغيًّا ولا يُحذف.
            </p>
            <Field label="سبب الإلغاء" hint="يُسجَّل مع الطلب ومع حركة الاسترجاع">
              <input className={INPUT} value={cancelReason} autoFocus
                onChange={(e) => setCancelReason(e.target.value)} placeholder="مثال: الهدية تالفة" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function Page() {
  return <Suspense><StoreScreen /></Suspense>;
}
