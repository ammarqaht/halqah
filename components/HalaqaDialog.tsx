'use client';
import { useEffect, useState } from 'react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
import { store, useDB } from '@/lib/store';
import type { Halaqa } from '@/lib/types';
import { Num } from '@/components/Num';

const blank = (): Halaqa => ({
  id: Math.random().toString(36).slice(2, 10),
  name: '', teacher: '', mosque: 'جامع محمد العبدالكريم — حي أُحد', timeSlot: 'العصر', notes: '',
});

export function HalaqaDialog({ open, halaqa, onClose }:
  { open: boolean; halaqa: Halaqa | null; onClose: () => void }) {
  const db = useDB();
  const [f, setF] = useState<Halaqa>(blank);
  useEffect(() => { if (open) setF(halaqa ? { ...halaqa } : blank()); }, [open, halaqa]);

  const count = db.students.filter((s) => s.halaqaId === f.id).length;
  const isNew = !halaqa;

  const save = () => {
    const name = f.name.trim() || (f.teacher.trim() ? `تحفيظ ${f.teacher.trim()} (${f.timeSlot})` : '');
    if (!name || !f.teacher.trim()) return;
    store.upsertHalaqa({ ...f, name });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'إضافة حلقة' : `تعديل حلقة ${halaqa?.teacher ?? ''}`}
      footer={
        <>
          {!isNew && (
            <Btn variant="ghost" className="me-auto text-risk-700"
              onClick={() => { if (confirm('سيُفصل طلاب الحلقة عنها ولن تُحذف بياناتهم. متابعة؟')) { store.removeHalaqa(f.id); onClose(); } }}>
              حذف الحلقة
            </Btn>
          )}
          <Btn onClick={onClose}>إلغاء</Btn>
          <Btn variant="primary" onClick={save}>حفظ</Btn>
        </>
      }>
      <div className="space-y-4">
        <Field label="المعلّم المسمِّع" hint="يظهر في القوائم والتقارير">
          <input className={INPUT} value={f.teacher} onChange={(e) => setF({ ...f, teacher: e.target.value })}
            placeholder="حسن محمد ماهر علي" />
        </Field>
        {/* المسجد is kept in the record — the client expects other mosques one day
            (القرار المعتمد ١٣) — but it is not asked for while there is only one. */}
        <Field label="الوقت">
          <select className={INPUT} value={f.timeSlot} onChange={(e) => setF({ ...f, timeSlot: e.target.value })}>
            {['الفجر', 'العصر', 'المغرب', 'العشاء'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="اسم الحلقة" hint="اتركه فارغًا ليُشتقّ من اسم المعلّم والوقت">
          <input className={INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder={f.teacher ? `تحفيظ ${f.teacher} (${f.timeSlot})` : 'تحفيظ … (العصر)'} />
        </Field>
        <Field label="ملاحظات">
          <input className={INPUT} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {!isNew && (
          <p className="rounded-lg bg-page px-3 py-2.5 text-panel text-ink-600">
            في هذه الحلقة <Num className="font-medium text-ink-900">{count}</Num> طالبًا.
            حذف الحلقة يفصلهم عنها ولا يحذف أحدًا.
          </p>
        )}
      </div>
    </Modal>
  );
}
