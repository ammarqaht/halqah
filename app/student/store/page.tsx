'use client';
/* طا-٤ المتجر — and «طلباتي» as a section of the same screen, because the
   approved navigation fixes four destinations and both can be true.

   An unaffordable gift stays VISIBLE and dimmed with the gap named:
   «لا يُخفى، ليكون حافزًا». Hiding it would remove the reason to earn. */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Store as StoreIcon, PackageCheck, Check } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty, Modal } from '@/components/ui';
import { Num, pointWord, orderWord } from '@/components/Num';
import { useMe } from '@/components/student/Me';
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

export default function StoreScreen() {
  const { me, reload } = useMe();
  const [gifts, setGifts] = useState<Gift[] | null>(null);
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [confirm, setConfirm] = useState<Gift | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [placed, setPlaced] = useState<{ number: number; gift: string } | null>(null);

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

  if (me && !me.eligibleForPoints) {
    return (
      <Sheet className="rise">
        <SheetHead title="المتجر" />
        <p className="text-base2 leading-relaxed text-ink-600">{COPY.talqeenPoints}</p>
      </Sheet>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-baseline justify-between gap-3 rounded-2xl border border-ink-150 bg-paper px-5 py-4 shadow-soft">
        <h1 className="font-display text-t1 text-ink-900">المتجر</h1>
        <p className="text-base2 text-ink-600">
          رصيدك <Num className="font-display text-lg2 text-brand-800">{balance}</Num> {pointWord(balance)}
        </p>
      </div>

      {gifts === null ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-44 rounded-2xl" />)}
        </div>
      ) : gifts.length === 0 ? (
        <Sheet className="rise"><Empty icon={StoreIcon} title="لا هدايا الآن" body={COPY.noGifts} /></Sheet>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {gifts.map((g) => {
            const can = g.availability === 'BUYABLE';
            return (
              <li key={g.id}
                className={cx('overflow-hidden rounded-2xl border border-ink-150 bg-paper shadow-soft transition-opacity',
                  !can && 'opacity-70')}>
                <div className="aspect-square w-full bg-ink-100">
                  {g.image
                    ? <img src={g.image} alt="" className="h-full w-full object-cover" />
                    : <span className="grid h-full place-items-center text-ink-300"><StoreIcon size={28} /></span>}
                </div>
                <div className="p-3">
                  <p className="truncate text-body font-medium text-ink-900" title={g.name}>{g.name}</p>
                  <p className="mt-1"><Chip tone="brand"><Num>{g.pointsCost}</Num> {pointWord(g.pointsCost)}</Chip></p>
                  {g.availability === 'CANNOT_AFFORD' && (
                    <p className="mt-1.5 text-micro text-warn-700">
                      تحتاج <Num>{g.shortBy}</Num> {pointWord(g.shortBy)} إضافية
                    </p>
                  )}
                  {g.availability === 'OUT_OF_STOCK' && (
                    <p className="mt-1.5 text-micro text-ink-500">غير متوفّر حاليًا</p>
                  )}
                  <Btn size="sm" variant={can ? 'primary' : undefined} disabled={!can}
                    className="mt-2.5 w-full" onClick={() => setConfirm(g)}>
                    {can ? 'اشترِ' : '—'}
                  </Btn>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet pad={false} className="rise">
        <div className="border-b border-ink-150 px-5 py-4">
          <h2 className="text-lg2 font-bold text-ink-900">
            طلباتي {orders?.length ? <span className="text-ink-500">
              (<Num>{orders.length}</Num> {orderWord(orders.length)})</span> : null}
          </h2>
        </div>
        {orders === null ? (
          <div className="space-y-2 p-5">{[0, 1].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}</div>
        ) : orders.length === 0 ? (
          <div className="p-5"><Empty icon={PackageCheck} title="لا طلبات بعد" body={COPY.noOrders} /></div>
        ) : (
          <ul className="divide-y divide-ink-150">
            {orders.map((o) => (
              <li key={o.number} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 font-display text-body text-brand-800">
                  <Num>{o.number}</Num>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink-900">{o.giftNameSnapshot}</span>
                  <span className="mt-0.5 block text-micro text-ink-500">
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
      </Sheet>

      <Modal open={confirm !== null} onClose={() => !busy && setConfirm(null)} title="تأكيد الشراء"
        footer={<>
          <Btn onClick={() => setConfirm(null)} disabled={busy}>تراجع</Btn>
          <Btn variant="primary" onClick={buy} disabled={busy}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> جارٍ…</> : 'أكمل الشراء'}
          </Btn>
        </>}>
        {confirm && (
          <div className="space-y-3">
            <p className="text-base2 text-ink-700">{COPY.buyConfirm(confirm.pointsCost, confirm.name)}</p>
            <p className="text-panel text-ink-500">
              رصيدك بعدها <Num className="font-medium text-ink-800">{balance - confirm.pointsCost}</Num> {pointWord(balance - confirm.pointsCost)}.
            </p>
            {err && <p role="alert" className="rounded-lg bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">{err}</p>}
          </div>
        )}
      </Modal>

      <Modal open={placed !== null} onClose={() => setPlaced(null)} title="تم الطلب"
        footer={<Btn variant="primary" onClick={() => setPlaced(null)}>تمام</Btn>}>
        {placed && (
          <div className="text-center">
            <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-ok-100 text-ok-700">
              <Check size={22} strokeWidth={2.6} />
            </span>
            <p className="text-base2 text-ink-700">{placed.gift}</p>
            <p className="mt-3 font-display text-d1 text-brand-800"><Num>{placed.number}</Num></p>
            <p className="mt-2 text-panel text-ink-600">{COPY.orderDone}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
