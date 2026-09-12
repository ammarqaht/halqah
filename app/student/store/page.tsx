'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   طا-٤ المتجر — and «طلباتي» as a section of the same screen, because the
   approved navigation fixes the destinations and both can be true.

   An unaffordable gift stays VISIBLE with the gap NAMED: «لا يُخفى، ليكون
   حافزًا». The prototype took that one step further and it is worth keeping —
   the shortfall gets a bar as well as a figure, so «بقي ٥٠ نقطة» is something
   he can see filling. Hiding the gift would remove the reason to earn; showing
   it dimmed with no distance named tells him nothing he can act on.

   And what he CAN afford sorts to the front, dearest first, so the top of the
   grid is always the best thing within reach today.
   ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Store as StoreIcon, PackageCheck, Check, Plus } from 'lucide-react';
import Link from 'next/link';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty, Modal } from '@/components/ui';
import { Num, pointWord, orderWord } from '@/components/Num';
import { useMe } from '@/components/student/Me';
import { useCountUp } from '@/components/student/motion';
import { COPY } from '@/content/student';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Gift = {
  id: string; name: string; description: string; image: string | null;
  pointsCost: number; availability: 'BUYABLE' | 'OUT_OF_STOCK' | 'CANNOT_AFFORD' | 'HIDDEN';
  shortBy: number;
};
type Order = {
  number: number; giftNameSnapshot: string; pointsSpent: number;
  status: string; statusAr: string; createdAt: string;
};

const CARD = 'rounded-2xl border border-ink-150 bg-paper shadow-soft';

export default function StoreScreen() {
  const { me, reload } = useMe();
  const [gifts, setGifts] = useState<Gift[] | null>(null);
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [confirm, setConfirm] = useState<Gift | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [placed, setPlaced] = useState<{ number: number; gift: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'can'>('all');

  const shown = useCountUp(balance, 800);

  const load = useCallback(() => {
    fetch('/api/student/store').then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setGifts(d.gifts ?? []); setBalance(d.balance ?? 0); } })
      .catch(() => setGifts([]));
    fetch('/api/student/orders').then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => setOrders(d.orders ?? [])).catch(() => setOrders([]));
  }, []);
  useEffect(load, [load]);

  const buy = async () => {
    if (!confirm || busy) return;
    setBusy(true); setErr('');
    const res = await fetch('/api/student/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftId: confirm.id }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) { setErr(data?.error ?? 'تعذّر إتمام الطلب.'); return; }
    setPlaced({ number: data.number, gift: confirm.name });
    setConfirm(null); load(); reload();
  };

  /* The nearest to his reach first: what he can buy (dearest first, because
     that is the best of it), then whatever he is closest to affording. */
  const sorted = useMemo(() => [...(gifts ?? [])].sort((a, b) => {
    const ca = a.availability === 'BUYABLE', cb = b.availability === 'BUYABLE';
    if (ca !== cb) return ca ? -1 : 1;
    return ca ? b.pointsCost - a.pointsCost : a.shortBy - b.shortBy;
  }), [gifts]);

  const affordable = sorted.filter((g) => g.availability === 'BUYABLE').length;
  const list = filter === 'can' ? sorted.filter((g) => g.availability === 'BUYABLE') : sorted;

  if (me && !me.eligibleForPoints) {
    return (
      <Sheet className="rise">
        <SheetHead title="المتجر" />
        <p className="text-base2 leading-relaxed text-ink-600">{COPY.talqeenPoints}</p>
      </Sheet>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* ── the balance, and the way to add to it ───────────────────────── */}
      <div className="rise flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-t1 text-ink-900">المتجر</h1>
        <Link href="/student/redeem"
          aria-label={`رصيدك ${balance} نقطة — اشحن كودًا`}
          className="card-field press flex h-10 shrink-0 items-center gap-2 rounded-full pe-1.5 ps-3.5 text-white shadow-[0_10px_24px_-10px_rgba(10,64,60,.6)]">
          <span className="relative whitespace-nowrap text-panel text-brand-100">
            <Num className="font-display text-xl2 text-white">{shown}</Num> {pointWord(balance)}
          </span>
          <span className="relative grid h-[26px] w-[26px] place-items-center rounded-full bg-white/20">
            <Plus size={15} strokeWidth={2.4} />
          </span>
        </Link>
      </div>

      {/* ── filters ─────────────────────────────────────────────────────── */}
      {sorted.length > 0 && (
        <div className="rise flex items-center justify-between gap-2.5">
          <div className="flex gap-1.5">
            <FilterChip on={filter === 'all'} onClick={() => setFilter('all')}>الكل</FilterChip>
            <FilterChip on={filter === 'can'} onClick={() => setFilter('can')} count={affordable}>
              أقدر أشتريها
            </FilterChip>
          </div>
          <span className="shrink-0 text-micro text-ink-500">
            {filter === 'can' ? 'مرتّبة حسب السعر' : 'مرتّبة حسب الأقرب لرصيدك'}
          </span>
        </div>
      )}

      {/* ── the shelf ───────────────────────────────────────────────────── */}
      {gifts === null ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-52 rounded-2xl" />)}
        </div>
      ) : list.length === 0 ? (
        <Sheet className="rise">
          <Empty icon={StoreIcon}
            title={filter === 'can' ? 'لا شيء في متناولك بعد' : 'لا هدايا الآن'}
            body={filter === 'can'
              ? 'اشحن أكوادك واجمع نقاطك — ستظهر هنا أوّل ما تكفي.'
              : COPY.noGifts} />
        </Sheet>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {list.map((g) => {
            const can = g.availability === 'BUYABLE';
            const out = g.availability === 'OUT_OF_STOCK';
            const pct = Math.min(100, Math.round((balance / Math.max(1, g.pointsCost)) * 100));
            return (
              <li key={g.id} className={cx(CARD, 'rise flex flex-col overflow-hidden')}>
                <div className={cx('relative grid aspect-square w-full place-items-center',
                  can ? 'bg-brand-100' : 'bg-ink-100')}>
                  {g.image
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={g.image} alt="" className="h-full w-full object-cover" />
                    : <StoreIcon size={28} className="text-ink-300" />}
                  {can && (
                    <span className="absolute top-2 grid h-[22px] place-items-center rounded-full bg-brand-800 px-2 text-2xs text-white start-2">
                      يمكنك شراؤها
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3 pt-2.5">
                  <p className="truncate text-sm2 font-medium text-ink-900" title={g.name}>{g.name}</p>
                  <p className="text-cap text-ink-600">
                    <Num className="font-display text-[16px] text-ink-900">{g.pointsCost}</Num>{' '}
                    {pointWord(g.pointsCost)}
                  </p>

                  {out ? (
                    <span className="mt-auto grid h-[38px] place-items-center rounded-[11px] bg-ink-100 text-panel text-ink-500">
                      غير متوفّر حاليًا
                    </span>
                  ) : can ? (
                    <button type="button" onClick={() => setConfirm(g)}
                      aria-label={`اشترِ ${g.name} بـ ${g.pointsCost} نقطة`}
                      className="press mt-auto h-[38px] rounded-[11px] bg-brand-800 text-sm2 font-bold text-white transition-colors hover:bg-brand-900">
                      اشترِ
                    </button>
                  ) : (
                    <div className="mt-auto">
                      <div className="h-[5px] overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full rounded-full bg-warn-500 transition-[width] duration-1000 ease-brand"
                          style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1.5 text-[11px] text-warn-700">
                        بقي <Num className="font-bold">{g.shortBy}</Num> {pointWord(g.shortBy)}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── طلباتي ──────────────────────────────────────────────────────── */}
      <section className={cx(CARD, 'rise overflow-hidden')}>
        <div className="flex items-baseline justify-between gap-3 px-[18px] pb-3 pt-3.5">
          <h2 className="text-base2 font-bold text-ink-900">
            طلباتي {orders?.length ? <span className="font-normal text-ink-500">
              (<Num>{orders.length}</Num> {orderWord(orders.length)})</span> : null}
          </h2>
          <span className="shrink-0 text-cap text-ink-500">اعرض الرقم عند الاستلام</span>
        </div>
        {orders === null ? (
          <div className="space-y-2 px-[18px] pb-[18px]">
            {[0, 1].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center gap-3 border-t border-ink-150 px-[18px] py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-400">
              <PackageCheck size={18} strokeWidth={1.8} />
            </span>
            <p className="text-xs2 text-ink-600">{COPY.noOrders}</p>
          </div>
        ) : (
          <ul>
            {orders.map((o) => (
              <li key={o.number} className="flex items-center gap-3 border-t border-ink-150 px-[18px] py-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 font-display text-lg2 text-brand-800">
                  <Num>{o.number}</Num>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm2 text-ink-900">{o.giftNameSnapshot}</span>
                  <span className="mt-px block text-micro text-ink-500">
                    <Num>{o.pointsSpent}</Num> {pointWord(o.pointsSpent)} · <Num>{formatDate(o.createdAt.slice(0, 10))}</Num>
                  </span>
                </span>
                <Chip tone={o.status === 'DELIVERED' ? 'ok' : o.status === 'CANCELLED' ? 'ink' : 'warn'}>
                  {o.statusAr}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Their `Modal` already rises from the bottom on a phone and centres on a
          desktop, so the prototype's bottom sheet needed no new component. */}
      <Modal open={confirm !== null} onClose={() => !busy && setConfirm(null)} title="تأكيد الشراء"
        footer={<>
          <Btn onClick={() => setConfirm(null)} disabled={busy}>تراجع</Btn>
          <Btn variant="primary" onClick={buy} disabled={busy}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> جارٍ…</> : 'أكمل الشراء'}
          </Btn>
        </>}>
        {confirm && (
          <div className="space-y-3">
            <div className="flex items-center gap-3.5 rounded-2xl border border-ink-150 bg-page p-3.5">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-brand-100">
                {confirm.image
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={confirm.image} alt="" className="h-full w-full object-cover" />
                  : <StoreIcon size={22} className="text-brand-800" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base2 font-medium text-ink-900">{confirm.name}</p>
                <p className="mt-0.5 text-xs2 text-ink-600">
                  ستُخصم <Num className="font-bold text-ink-900">{confirm.pointsCost}</Num> {pointWord(confirm.pointsCost)}
                </p>
              </div>
            </div>
            <div className="flex justify-between px-1 text-panel text-ink-600">
              <span>رصيدك بعدها</span>
              <span>
                <Num className="font-display text-xl2 text-brand-800">{balance - confirm.pointsCost}</Num>{' '}
                {pointWord(balance - confirm.pointsCost)}
              </span>
            </div>
            {err && <p role="alert" className="rounded-lg bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">{err}</p>}
          </div>
        )}
      </Modal>

      <Modal open={placed !== null} onClose={() => setPlaced(null)} title="تم الطلب"
        footer={<Btn variant="primary" onClick={() => setPlaced(null)}>تمام</Btn>}>
        {placed && (
          <div className="text-center">
            <span className="mx-auto mb-3.5 grid h-16 w-16 place-items-center rounded-full bg-ok-100 text-ok-700">
              <Check size={30} strokeWidth={2.8} />
            </span>
            <p className="text-sm2 text-ink-600">{placed.gift}</p>
            <p className="mt-4 text-micro tracking-[.12em] text-ink-500">رقم الاستلام</p>
            <Num className="mt-1 block font-display text-[64px] leading-none text-brand-800">
              {placed.number}
            </Num>
            <p className="mt-3 text-xs2 text-ink-600">{COPY.orderDone}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FilterChip({ on, onClick, count, children }: {
  on: boolean; onClick: () => void; count?: number; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cx('press flex h-[34px] items-center gap-1.5 rounded-full border px-3.5 text-panel font-medium transition-colors',
        on ? 'border-brand-800 bg-brand-800 text-white' : 'border-ink-200 bg-paper text-ink-700')}>
      {children}
      {count !== undefined && (
        <Num className={cx('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]',
          on ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-800')}>{count}</Num>
      )}
    </button>
  );
}
