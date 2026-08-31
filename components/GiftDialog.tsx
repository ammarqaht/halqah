'use client';
/* إضافة هدية وتعديلها — approved PDF §8 (إد-٤-ج).
   The five fields the client named — «اسم الهدية · صورة · وصف مختصر · قيمتها
   بالنقاط · الكمية المتوفرة» — plus the two he described in prose: the
   low-stock threshold that raises an alert on the overview, and the
   visible/hidden state that lets him retire a gift «دون حذفها». */
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num, orderWord } from '@/components/Num';
import { store, useDB } from '@/lib/store';
import { toStoredImage, IMAGE_ERROR_AR } from '@/lib/image';
import { GIFT_CATEGORIES, type Gift } from '@/lib/types';
import { cx } from '@/lib/cx';

const blank = (): Gift => ({
  id: Math.random().toString(36).slice(2, 10),
  name: '', description: '', image: null,
  pointsCost: 100, quantity: 10, lowStockThreshold: 3,
  category: GIFT_CATEGORIES[0], status: 'VISIBLE',
  createdAt: new Date().toISOString(),
});

export function GiftDialog({ open, gift, onClose }:
  { open: boolean; gift: Gift | null; onClose: () => void }) {
  const db = useDB();
  const [f, setF] = useState<Gift>(blank);
  const [imgError, setImgError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setF(gift ? { ...gift } : blank());
    setImgError(null);
    setBusy(false);
  }, [open, gift]);

  const isNew = !gift;
  const ordered = gift ? db.orders.filter((o) => o.giftId === gift.id) : [];
  const pending = ordered.filter((o) => o.status === 'PENDING').length;

  /* Categories the supervisor already used, so his own vocabulary is offered
     back before ours. `creatable` lets him add one without leaving the form. */
  const categories = [...new Set([...db.gifts.map((g) => g.category), ...GIFT_CATEGORIES])]
    .filter(Boolean).map((c) => ({ value: c, label: c }));

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setImgError(null);
    const res = await toStoredImage(file);
    setBusy(false);
    if (!res.ok) { setImgError(IMAGE_ERROR_AR[res.error]); return; }
    setF((p) => ({ ...p, image: res.dataUrl }));
  };

  const valid = f.name.trim().length > 0 && f.pointsCost > 0 && f.quantity >= 0;

  const save = () => {
    if (!valid) return;
    store.upsertGift({ ...f, name: f.name.trim(), description: f.description.trim() });
    const err = store.persistError();
    if (err) { setImgError(err); return; }     // don't close over a failed write
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide title={isNew ? 'إضافة هدية' : `تعديل ${gift?.name ?? ''}`}
      footer={
        <>
          {!isNew && (
            <Btn variant="ghost" className="me-auto text-risk-700"
              onClick={() => {
                if (pending > 0) return;
                if (confirm('ستُحذف الهدية من المتجر. الطلبات السابقة تبقى في السجلّ بأسمائها وقيمها. متابعة؟')) {
                  store.removeGift(f.id); onClose();
                }
              }}
              disabled={pending > 0}
              title={pending > 0 ? 'لا تُحذف هدية عليها طلبات لم تُسلَّم بعد' : undefined}>
              حذف الهدية
            </Btn>
          )}
          <Btn onClick={onClose}>إلغاء</Btn>
          <Btn variant="primary" onClick={save} disabled={!valid || busy}>حفظ</Btn>
        </>
      }>
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-[10rem,1fr]">

          {/* ── image ──────────────────────────────────────────────────── */}
          <div>
            <span className="mb-1.5 block text-xs2 font-medium text-ink-600">الصورة</span>
            <div className={cx('relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border',
              f.image ? 'border-ink-150' : 'border-dashed border-ink-300 bg-page/50')}>
              {f.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.image} alt={f.name || 'صورة الهدية'} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setF({ ...f, image: null })}
                    aria-label="إزالة الصورة"
                    className="absolute end-1.5 top-1.5 rounded-full bg-paper/90 p-1 text-ink-600 shadow-card transition-colors hover:text-risk-700">
                    <X size={14} strokeWidth={2.2} />
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                  className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-500 transition-colors hover:text-brand-800">
                  <ImagePlus size={22} strokeWidth={1.7} />
                  <span className="text-micro">{busy ? 'جارٍ…' : 'اختر صورة'}</span>
                </button>
              )}
            </div>
            {f.image && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                className="mt-1.5 w-full text-center text-micro text-ink-500 transition-colors hover:text-brand-800">
                تغيير الصورة
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }} />
          </div>

          {/* ── the rest ───────────────────────────────────────────────── */}
          <div className="space-y-4">
            <Field label="اسم الهدية">
              <input className={INPUT} value={f.name} autoFocus
                onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ساعة يد" />
            </Field>
            <Field label="وصف مختصر" hint="سطر واحد يراه الطالب تحت الاسم">
              <input className={INPUT} value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
                placeholder="ساعة رقمية مقاومة للماء" />
            </Field>
            <Field label="التصنيف" hint="يرتّب المتجر أمام الطالب">
              <Combobox value={f.category} onChange={(v) => setF({ ...f, category: v })}
                options={categories} creatable createLabel="تصنيف جديد" />
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="القيمة بالنقاط">
            <input className={INPUT} inputMode="numeric" value={f.pointsCost || ''}
              onChange={(e) => setF({ ...f, pointsCost: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
              placeholder="100" />
          </Field>
          <Field label="الكمية المتوفّرة">
            <input className={INPUT} inputMode="numeric" value={f.quantity === 0 ? '0' : f.quantity || ''}
              onChange={(e) => setF({ ...f, quantity: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
              placeholder="10" />
          </Field>
          <Field label="حدّ التنبيه" hint="ينبّهك عند بلوغه">
            <input className={INPUT} inputMode="numeric" value={f.lowStockThreshold === 0 ? '0' : f.lowStockThreshold || ''}
              onChange={(e) => setF({ ...f, lowStockThreshold: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
              placeholder="3" />
          </Field>
        </div>

        {/* Hiding rather than deleting — the client's own distinction. */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-page px-3.5 py-3 text-panel">
          <input type="checkbox" checked={f.status === 'VISIBLE'}
            onChange={(e) => setF({ ...f, status: e.target.checked ? 'VISIBLE' : 'HIDDEN' })}
            className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-ink-300 accent-brand-800" />
          <span className="text-ink-700">
            <strong className="text-ink-900">معروضة في متجر الطالب.</strong>{' '}
            أزل العلامة لتُخفيها دون حذفها، ثم أعِدها حين تتوفّر.
          </span>
        </label>

        {imgError && (
          <p className="rounded-lg bg-risk-100 px-3.5 py-3 text-panel text-risk-700">{imgError}</p>
        )}

        {!isNew && ordered.length > 0 && (
          <p className="rounded-lg bg-page px-3.5 py-2.5 text-panel text-ink-600">
            على هذه الهدية <Num className="font-medium text-ink-900">{ordered.length}</Num> {orderWord(ordered.length)}
            {pending > 0 && <>، منها <Num className="font-medium text-warn-700">{pending}</Num> لم تُسلَّم بعد</>}.
            {pending > 0 && ' سلّمها أو ألغِها قبل حذف الهدية.'}
          </p>
        )}

        {f.quantity === 0 && f.status === 'VISIBLE' && (
          <p className="rounded-lg bg-warn-100 px-3.5 py-2.5 text-panel text-warn-700">
            الكمية صفر، فستظهر للطالب «غير متوفّر حاليًا» ولن يستطيع شراءها.
          </p>
        )}
      </div>
    </Modal>
  );
}
