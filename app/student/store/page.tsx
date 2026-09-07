'use client';
/* طا-٤ المتجر — what I can buy, and what I am still short of. */
import { useState } from 'react';
import { Store as StoreIcon, CheckCircle2 } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Btn, Chip, Empty, Modal } from '@/components/ui';
import { Num } from '@/components/Num';
import { store, useDB } from '@/lib/store';
import { useStudentId, StudentPicker } from '@/components/StudentGate';
import { balanceOf, earnsPoints } from '@/lib/points';
import { ORDER_STATUS_AR, type Gift } from '@/lib/types';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

export default function StudentStore() {
  const db = useDB();
  const [id, setId] = useStudentId();
  const me = db.students.find((s) => s.id === id) ?? null;
  const [confirm, setConfirm] = useState<Gift | null>(null);
  const [done, setDone] = useState<{ n: string; ref: number } | null>(null);
  const [err, setErr] = useState('');

  if (!me) return <StudentPicker onPick={setId} />;

  if (!earnsPoints(me)) {
    return (
      <div className="mx-auto max-w-lg px-5 py-10">
        <Empty icon={StoreIcon} title="المتجر لطلاب المسارات"
          body="طلاب التلقين خارج نظام النقاط والمتجر." />
      </div>
    );
  }

  const balance = balanceOf(db.txns, me.id);
  const gifts = db.gifts.filter((g) => g.status === 'VISIBLE');
  const mine = db.orders.filter((o) => o.studentId === me.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const buy = (g: Gift) => {
    const r = store.purchase(me.id, g.id);
    setConfirm(null);
    if (r.ok) { setDone({ n: g.name, ref: r.order.number }); setErr(''); }
    else setErr(r.block === 'INSUFFICIENT_BALANCE' ? 'رصيدك لا يكفي.'
      : r.block === 'OUT_OF_STOCK' ? 'نفدت الكمية.'
      : r.block === 'HIDDEN' ? 'هذه الهدية لم تعد معروضة.'
      : 'هذا الحساب لا يستقبل نقاطًا.');
  };

  return (
    <div className="mx-auto max-w-lg px-5 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-d2 text-ink-900">المتجر</h1>
        <p className="text-panel text-ink-600">
          رصيدك <Num className="font-medium text-ink-900">{balance}</Num>
        </p>
      </div>

      {done && (
        <Sheet className="fade mt-5 border-ok-200 bg-ok-100">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-ok-700" />
            <div>
              <p className="text-lg2 font-medium text-ok-700">تم شراء {done.n}</p>
              <p className="mt-1 text-base2 text-ink-700">
                رقم طلبك <Num className="font-medium">{done.ref}</Num> — اعرضه عند الاستلام.
              </p>
            </div>
          </div>
        </Sheet>
      )}
      {err && (
        <p className="fade mt-5 rounded-xl border border-risk-200 bg-risk-100 px-4 py-3 text-base2 text-risk-700">{err}</p>
      )}

      {gifts.length === 0 ? (
        <Sheet className="mt-5">
          <Empty icon={StoreIcon} title="لا هدايا معروضة الآن" body="اسأل معلّمك متى تُعرض هدايا جديدة." />
        </Sheet>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {gifts.map((g) => {
            const short = g.pointsCost - balance;
            const out = g.quantity <= 0;
            const can = !out && short <= 0;
            return (
              <button key={g.id} disabled={!can} onClick={() => setConfirm(g)}
                className={cx('flex flex-col rounded-xl border bg-paper p-3 text-start transition-all',
                  can ? 'border-ink-150 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft'
                      : 'border-ink-150 opacity-60')}>
                <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-ink-100">
                  {g.image
                    ? <img src={g.image} alt="" className="h-full w-full object-cover" />
                    : <StoreIcon size={26} className="text-ink-300" />}
                </div>
                <p className="text-body font-medium text-ink-900">{g.name}</p>
                <p className="mt-1 text-panel text-brand-800"><Num>{g.pointsCost}</Num> نقطة</p>
                {out
                  ? <Chip tone="ink">غير متوفّر</Chip>
                  : short > 0 && <Chip tone="warn">تحتاج <Num>{short}</Num> نقطة</Chip>}
              </button>
            );
          })}
        </div>
      )}

      {mine.length > 0 && (
        <Sheet className="mt-6">
          <h2 className="mb-3 text-lg2 font-bold text-ink-900">طلباتي</h2>
          <ul className="divide-y divide-ink-150">
            {mine.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink-900">{o.giftNameSnapshot}</span>
                  <span className="block text-micro text-ink-500">
                    طلب رقم <Num>{o.number}</Num> · <Num>{formatDate(o.createdAt)}</Num>
                  </span>
                </span>
                <Chip tone={o.status === 'DELIVERED' ? 'ok' : o.status === 'CANCELLED' ? 'risk' : 'warn'}>
                  {ORDER_STATUS_AR[o.status]}
                </Chip>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="تأكيد الشراء"
        footer={<>
          <Btn onClick={() => setConfirm(null)}>إلغاء</Btn>
          <Btn variant="primary" onClick={() => confirm && buy(confirm)}>نعم، اشترِ</Btn>
        </>}>
        {confirm && (
          <p className="text-base2 text-ink-800">
            ستُخصم <Num className="font-medium">{confirm.pointsCost}</Num> نقطة مقابل «{confirm.name}»،
            فيبقى رصيدك <Num className="font-medium">{balance - confirm.pointsCost}</Num>.
          </p>
        )}
      </Modal>
    </div>
  );
}
