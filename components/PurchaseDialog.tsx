'use client';
/* صرف هدية لطالب — the admin-side entry to the purchase in §8 (إد-٤-ج).
   The approved PDF describes the purchase happening in the student's portal
   (طا-٤), which is BUILD_PLAN phase 7. This dialog exists because the supervisor
   has to be able to hand a gift across the desk before that portal ships, and
   because a store screen whose orders table can never fill is untestable.

   It is deliberately not a second implementation: it calls `store.purchase`,
   the identical transaction the portal will call, so the two can never drift.
   Recorded in SPEC.md §6.6 as an addition beyond the PDF, for the client to
   confirm or drop. */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Gift as GiftIcon } from 'lucide-react';
import { Modal, Btn, Field } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num, pointWord } from '@/components/Num';
import { store, useDB } from '@/lib/store';
import { balances, earnsPoints, purchaseBlock, PURCHASE_BLOCK_AR } from '@/lib/points';
import { shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

export function PurchaseDialog({ open, onClose, defaultGift = null, onDone }: {
  open: boolean;
  onClose: () => void;
  defaultGift?: string | null;
  onDone?: (orderNumber: number) => void;
}) {
  const db = useDB();
  const [studentId, setStudentId] = useState('');
  const [giftId, setGiftId] = useState('');

  useEffect(() => {
    if (!open) return;
    setStudentId('');
    setGiftId(defaultGift ?? '');
  }, [open, defaultGift]);

  const bal = useMemo(() => balances(db.txns), [db.txns]);
  const balanceOf = (id: string) => bal.get(id)?.balance ?? 0;

  const studentOptions = useMemo(() =>
    db.students.filter(earnsPoints)
      .map((s) => ({
        value: s.id,
        label: s.fullName,
        hint: ((n) => `${n} ${pointWord(n)}`)(balanceOf(s.id)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ar')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.students, bal]);

  const giftOptions = useMemo(() =>
    db.gifts.map((g) => ({
      value: g.id,
      label: g.name,
      hint: `${g.pointsCost} ${pointWord(g.pointsCost)} · متوفّر ${g.quantity}`,
    })), [db.gifts]);

  const student = db.students.find((s) => s.id === studentId) ?? null;
  const gift = db.gifts.find((g) => g.id === giftId) ?? null;
  const balance = student ? balanceOf(student.id) : 0;

  const block = student && gift ? purchaseBlock(student, gift, balance) : null;
  const ready = !!student && !!gift && !block;

  const buy = () => {
    if (!ready || !student || !gift) return;
    const res = store.purchase(student.id, gift.id);
    if (res.ok) onDone?.(res.order.number);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide title="صرف هدية لطالب"
      footer={
        <>
          <Btn onClick={onClose}>إلغاء</Btn>
          <Btn variant="primary" icon={GiftIcon} onClick={buy} disabled={!ready}>تأكيد الصرف</Btn>
        </>
      }>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الطالب" hint="الرصيد يظهر بجانب كل اسم">
            <Combobox value={studentId} onChange={setStudentId} options={studentOptions}
              placeholder="اختر الطالب" searchPlaceholder="ابحث بالاسم…" emptyText="لا طالب بهذا الاسم" />
          </Field>
          <Field label="الهدية">
            <Combobox value={giftId} onChange={setGiftId} options={giftOptions}
              placeholder="اختر الهدية" searchPlaceholder="ابحث…" emptyText="لا توجد هدايا بعد" />
          </Field>
        </div>

        {student && (
          <p className="text-panel text-ink-600">
            {shortName(student.fullName)} — رصيده الآن{' '}
            <Num className="font-medium text-ink-900">{balance}</Num> {pointWord(balance)}.
          </p>
        )}

        {block && (
          <div className="flex items-start gap-2.5 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-risk-700" />
            <p className="text-panel text-risk-700">
              {PURCHASE_BLOCK_AR[block]}
              {block === 'INSUFFICIENT_BALANCE' && gift && (
                <> — ينقصه <Num className="font-medium">{gift.pointsCost - balance}</Num> {pointWord(gift.pointsCost - balance)}.</>
              )}
            </p>
          </div>
        )}

        {ready && gift && (
          <div className={cx('rounded-xl border border-brand-200 bg-brand-50 p-4')}>
            <p className="text-base2 text-ink-800">
              ستُخصم <Num className="font-medium text-brand-800">{gift.pointsCost}</Num> {pointWord(gift.pointsCost)}،
              فيصير الرصيد <Num className="font-medium text-brand-800">{balance - gift.pointsCost}</Num>،
              وتنقص كمية «{gift.name}» إلى <Num className="font-medium">{gift.quantity - 1}</Num>.
            </p>
            <p className="mt-1.5 text-panel text-ink-600">
              يُسجَّل الطلب بانتظار التسليم، ويظهر في جدول الطلبات برقمه.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
