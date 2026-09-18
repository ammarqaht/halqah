'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   مع-٧ نقاط حلقتي.

   «أرصدة طلابه · حركات النقاط لكل طالب بمصادرها · لوحة شرف الحلقة · وطلبات
   المتجر لطلابه عرضًا فقط.»

   There is not one button on this screen that changes a number, and that is the
   point: «ليس في يد المعلم نقاط يمنحها بتقديره» — the daily points are computed
   from his own registration and everything else (أكواد، مكافآت، خصم، تسليم) is
   the supervisor's. So the screen says so once, at the top, and then shows him
   what he actually needs: who has what, where it came from, and the five names
   he can print and pin to the wall.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins, Info, Printer, ShoppingBag } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty, Modal } from '@/components/ui';
import { Num, pointWord } from '@/components/Num';
import { useCountUp } from '@/components/student/motion';
import { COPY } from '@/content/teacher';
import { relativeDay } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Row = {
  id: string; fullName: string; shortName: string; trackAr: string | null;
  balance: number; granted: number; redeemed: number; deducted: number;
  lastAt: string | null;
};

type Move = {
  id: string; studentId: string; studentName: string; delta: number;
  kind: string; kindAr: string; reason: string; on: string;
};

type Payload = {
  students: Row[];
  total: number;
  honour: (Row & { place: number })[];
  moves: Move[];
  orders: {
    id: string; number: number; studentName: string; gift: string;
    pointsSpent: number; status: string; createdAt: string;
  }[];
  talqeenOnly?: boolean;
};

const CARD = 'rounded-2xl border border-ink-150 bg-paper shadow-soft';

/**
 * How many movements sit on the screen before «عرض الكل» takes the rest.
 *
 * «حركات النقاط في صفحة النقاط لا تعرض إلا ١٠ فقط، وزرّ عرض الكل يعرضها في
 * نافذة» (client, 18 Sep 2026) — the same ten as ملف الطالب's ledger, for the
 * same reason: a term of movements under the balances is a list that pushes
 * everything else off the screen and that nobody scrolls to the end of.
 */
const MOVES_SHOWN = 10;

const ORDER_AR: Record<string, string> = {
  PENDING: 'بانتظار التسليم', DELIVERED: 'سُلِّم', CANCELLED: 'أُلغي',
};

export default function PointsScreen() {
  const [d, setD] = useState<Payload | null>(null);
  const [allMoves, setAllMoves] = useState(false);
  const total = useCountUp(d?.total ?? 0, 900);

  useEffect(() => {
    fetch('/api/teacher/points')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setD(j))
      .catch(() => setD(null));
  }, []);

  if (!d) {
    return (
      <div className="space-y-3.5">
        <div className="skel h-[120px] rounded-2xl" />
        <div className="skel h-[260px] rounded-2xl" />
      </div>
    );
  }

  if (d.talqeenOnly || d.students.length === 0) {
    return (
      <Sheet>
        <Empty icon={Coins} title="لا نقاط في هذه الحلقة"
          body={d.talqeenOnly ? COPY.talqeenOnly : COPY.noPoints} />
      </Sheet>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* ── رصيد الحلقة، ثم السطر الذي يوضّح حدود المعلم ──────────────────── */}
      <section className={cx(CARD, 'rise px-[18px] py-4')}>
        <p className="text-micro tracking-[.12em] text-ink-500">رصيد حلقتي</p>
        <p className="mt-1 flex items-baseline gap-2">
          <Num className="font-display text-[clamp(38px,11vw,50px)] leading-none text-brand-800">
            {total}
          </Num>
          <span className="text-lg2 text-ink-600">{pointWord(d.total)}</span>
        </p>
        <p className="mt-3 flex items-start gap-2 text-xs2 leading-relaxed text-ink-500">
          <Info size={14} className="mt-0.5 shrink-0 text-ink-400" />
          {COPY.pointsFixed}
        </p>
      </section>

      {/* ── لوحة الشرف ───────────────────────────────────────────────────── */}
      {d.honour.length > 0 && (
        <section className={cx(CARD, 'rise px-[18px] py-4')}>
          <SheetHead title={COPY.honourBoard} meta="أعلى خمسة — قابلة للطباعة وتعليقها"
            action={
              <Link href="/teacher/print/honour" target="_blank">
                <Btn size="sm" icon={Printer}>اطبعها</Btn>
              </Link>
            } />
          <ol className="space-y-1.5">
            {d.honour.map((h) => (
              <li key={h.id} className="flex items-center gap-3">
                <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-base2',
                  h.place === 1 ? 'bg-warn-200 text-warn-700'
                    : h.place === 2 ? 'bg-ink-150 text-ink-700'
                    : h.place === 3 ? 'bg-brand-100 text-brand-800'
                    : 'bg-page text-ink-500')}>
                  <Num>{h.place}</Num>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm2 text-ink-900">{h.fullName}</span>
                <Num className="shrink-0 font-display text-lg2 tabular-nums text-brand-800">
                  {h.balance}
                </Num>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── أرصدة طلابي ──────────────────────────────────────────────────── */}
      <section className={cx(CARD, 'rise overflow-hidden')}>
        <div className="px-[18px] pb-2 pt-4">
          <SheetHead title="أرصدة طلابي"
            meta="الرصيد مجموع الحركات، لا رقمًا مخزَّنًا — فلا يختلّ ولا يضيع أثر" />
        </div>
        <ul>
          {[...d.students].sort((a, b) => b.balance - a.balance).map((r) => (
            <li key={r.id} className="border-t border-ink-150 px-[18px] py-2.5">
              <Link href={`/teacher/students/${r.id}`}
                className="press flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm2 text-ink-900">{r.fullName}</p>
                  <p className="mt-px flex flex-wrap items-center gap-x-2 text-micro text-ink-500">
                    {r.trackAr && <span>{r.trackAr}</span>}
                    <span>· كُسب <Num>{r.granted}</Num></span>
                    {r.redeemed > 0 && <span>· استُبدل <Num>{r.redeemed}</Num></span>}
                    {r.deducted > 0 && <span>· خُصم <Num>{r.deducted}</Num></span>}
                    {r.lastAt && <span>· {relativeDay(r.lastAt.slice(0, 10))}</span>}
                  </p>
                </div>
                <Num className="shrink-0 font-display text-lg2 tabular-nums text-ink-900">
                  {r.balance}
                </Num>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── الحركات بمصادرها ─────────────────────────────────────────────── */}
      <section className={cx(CARD, 'rise overflow-hidden')}>
        <div className="px-[18px] pb-2 pt-4">
          <SheetHead title="حركات النقاط"
            meta="بمصادرها: يومية · اختبارات · أكواد · مشتريات · خصم — وبتاريخ يومها لا تاريخ إدخالها" />
        </div>
        {d.moves.length === 0 ? (
          <div className="px-[18px] pb-4">
            <Empty icon={Coins} title="لا حركة بعد" body={COPY.noPoints} />
          </div>
        ) : (
          <>
            <ul>
              {d.moves.slice(0, MOVES_SHOWN).map((m) => <MoveRow key={m.id} move={m} />)}
            </ul>
            {d.moves.length > MOVES_SHOWN && (
              <div className="border-t border-ink-150 p-2.5">
                <Btn className="w-full" onClick={() => setAllMoves(true)}>
                  عرض الكل (<Num>{d.moves.length}</Num>)
                </Btn>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── طلبات المتجر — عرضًا فقط ─────────────────────────────────────── */}
      {d.orders.length > 0 && (
        <section className={cx(CARD, 'rise overflow-hidden')}>
          <div className="px-[18px] pb-2 pt-4">
            <SheetHead title="طلبات المتجر" meta={COPY.ordersView} />
          </div>
          <ul>
            {d.orders.map((o) => (
              <li key={o.id}
                className="flex items-center gap-3 border-t border-ink-150 px-[18px] py-2.5">
                <span className="grid h-8 w-10 shrink-0 place-items-center rounded-lg bg-page">
                  <Num className="text-panel font-bold tabular-nums text-ink-700">{o.number}</Num>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm2 text-ink-900">{o.gift}</p>
                  <p className="mt-px truncate text-micro text-ink-500">
                    {o.studentName} · <Num>{o.pointsSpent}</Num> نقطة · {relativeDay(o.createdAt)}
                  </p>
                </div>
                <Chip tone={o.status === 'DELIVERED' ? 'ok'
                  : o.status === 'CANCELLED' ? 'ink' : 'warn'}>
                  {ORDER_AR[o.status] ?? o.status}
                </Chip>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.orders.length === 0 && (
        <Sheet>
          <Empty icon={ShoppingBag} title="لا طلبات"
            body="لم يطلب أحد من طلابك شيئًا من المتجر بعد." />
        </Sheet>
      )}

      {/* ── كل الحركات ───────────────────────────────────────────────────── */}
      <Modal open={allMoves} onClose={() => setAllMoves(false)} title="كل حركات النقاط" wide
        footer={<Btn variant="primary" onClick={() => setAllMoves(false)}>تم</Btn>}>
        <ul className="-mx-1 max-h-[60vh] overflow-y-auto rounded-xl border border-ink-150">
          {d.moves.map((m) => <MoveRow key={m.id} move={m} />)}
        </ul>
      </Modal>
    </div>
  );
}

/** حركة واحدة — the same row on the card and in the window, so the ten a
    teacher sees and the rest he opens cannot be laid out differently. */
function MoveRow({ move: m }: { move: Move }) {
  return (
    <li className="flex items-center gap-3 border-t border-ink-150 px-[18px] py-2.5 first:border-t-0">
      <Num className={cx('w-12 shrink-0 font-display text-lg2',
        m.delta >= 0 ? 'text-ok-700' : 'text-risk-700')}>
        {m.delta >= 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
      </Num>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm2 text-ink-900">{m.studentName}</p>
        <p className="mt-px truncate text-micro text-ink-500">
          {m.reason || m.kindAr} · {relativeDay(m.on)}
        </p>
      </div>
      <Chip tone={m.kind === 'DAILY' ? 'ok' : m.kind === 'CODE' ? 'brand'
        : m.kind === 'EXAM' ? 'info' : m.kind === 'PURCHASE' ? 'risk' : 'ink'}>
        {m.kindAr}
      </Chip>
    </li>
  );
}
