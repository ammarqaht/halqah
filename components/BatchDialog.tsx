'use client';
/* إصدار دفعة أكواد — the approved PDF §8 (إد-٤-ب).
   The client's own description of the ritual we are replacing: «أطبع نقاط
   تحفيز — أوراق الباركود — نسوّي لها توليد؛ عندي واحدة عشر نقاط للحضور،
   والثانية للتسميع». So a batch is exactly four decisions — value, how many,
   what for, and when it dies — and nothing else. */
import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num, cardWord, pointWord } from '@/components/Num';
import { store } from '@/lib/store';
import { cardColour } from '@/lib/points';
import { CODE_PURPOSES } from '@/lib/types';
import { isoDate } from '@/lib/dates';

const COMMON_VALUES = [5, 10, 20, 25, 50];

export function BatchDialog({ open, onClose, onIssued }: {
  open: boolean;
  onClose: () => void;
  /** Handed the new batch id so the caller can send the supervisor to print. */
  onIssued?: (batchId: string) => void;
}) {
  const [value, setValue] = useState('10');
  const [quantity, setQuantity] = useState('40');
  const [purpose, setPurpose] = useState<string>(CODE_PURPOSES[0]);
  const [expires, setExpires] = useState('');

  useEffect(() => {
    if (!open) return;
    setValue('10'); setQuantity('40'); setPurpose(CODE_PURPOSES[0]); setExpires('');
  }, [open]);

  const v = Number(value);
  const q = Number(quantity);
  const valid = v > 0 && q > 0 && q <= 500;
  const colour = useMemo(() => cardColour(v || 0), [v]);

  const issue = (thenPrint: boolean) => {
    if (!valid) return;
    const batch = store.issueBatch({ value: v, quantity: q, purpose, expiresAt: expires || null });
    if (batch && thenPrint) onIssued?.(batch.id);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide title="إصدار دفعة أكواد"
      footer={
        <>
          <Btn onClick={onClose}>إلغاء</Btn>
          <Btn onClick={() => issue(false)} disabled={!valid}>إصدار</Btn>
          <Btn variant="primary" icon={Printer} onClick={() => issue(true)} disabled={!valid}>
            إصدار وطباعة
          </Btn>
        </>
      }>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="قيمة الكود بالنقاط">
            <input className={INPUT} inputMode="numeric" value={value} autoFocus
              onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))} placeholder="10" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMMON_VALUES.map((c) => (
                <button key={c} type="button" onClick={() => setValue(String(c))}
                  className="rounded border border-ink-200 bg-paper px-2 py-1 text-cap text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800">
                  <Num>{c}</Num>
                </button>
              ))}
            </div>
          </Field>
          <Field label="عدد الأكواد" hint="حتى ٥٠٠ بطاقة في الدفعة الواحدة">
            <input className={INPUT} inputMode="numeric" value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ''))} placeholder="40" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الغرض" hint="يظهر على البطاقة وفي متابعة الدفعات">
            <Combobox value={purpose} onChange={setPurpose} creatable createLabel="غرض جديد"
              options={CODE_PURPOSES.map((p) => ({ value: p, label: p }))} />
          </Field>
          <Field label="تاريخ الانتهاء" hint="اختياري — حتى لا تبقى بطاقة قديمة صالحة إلى الأبد">
            <input type="date" className={INPUT} value={expires} min={isoDate(new Date())}
              onChange={(e) => setExpires(e.target.value)} />
          </Field>
        </div>

        {/* A card, at the size it prints, so the value and its colour are seen
            before four hundred of them come out of the printer. */}
        {valid && (
          <div className="flex flex-wrap items-center gap-5 rounded-xl border border-ink-150 bg-page/50 p-4">
            <div className="w-40 shrink-0 rounded-lg border p-3 text-center"
              style={{ borderColor: colour.rule, background: colour.wash }}>
              <p className="text-micro" style={{ color: colour.ink }}>{purpose}</p>
              <p className="font-display leading-none" style={{ color: colour.ink, fontSize: 30 }}>
                <Num>{v}</Num>
              </p>
              <p className="mt-0.5 text-micro" style={{ color: colour.ink }}>{pointWord(v)}</p>
              <div className="mx-auto mt-2 h-10 w-10 rounded-sm"
                style={{ background: `repeating-conic-gradient(${colour.ink} 0 25%, transparent 0 50%) 0 0/6px 6px` }} />
              <p className="mt-2 font-medium tracking-widest" style={{ color: colour.ink, fontSize: 10 }}>XXXXX-XXXXX</p>
            </div>
            <div className="min-w-0 text-base2 text-ink-700">
              <p>
                <Num className="font-medium text-ink-900">{q}</Num> {cardWord(q)} ×{' '}
                <Num className="font-medium text-ink-900">{v}</Num> {pointWord(v)} ={' '}
                <Num className="font-medium text-brand-800">{q * v}</Num> {pointWord(q * v)} إجمالًا.
              </p>
              <p className="mt-1 text-panel text-ink-500">
                لون البطاقة يتبع القيمة، فتُفرز باليد بسرعة. الأرقام عشوائية غير متسلسلة، وكل رقم يعمل مرة واحدة.
              </p>
            </div>
          </div>
        )}

        {q > 500 && (
          <p className="rounded-lg bg-risk-100 px-3.5 py-3 text-panel text-risk-700">
            العدد أكبر من ٥٠٠. أصدر دفعات أصغر حتى تبقى الطباعة والفرز قابلين للإدارة.
          </p>
        )}
      </div>
    </Modal>
  );
}
