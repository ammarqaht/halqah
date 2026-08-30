'use client';
import { useEffect, useState } from 'react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { store, useDB } from '@/lib/store';
import { TRACK_AR, type Halaqa, type Track } from '@/lib/types';
import { Num } from '@/components/Num';

const TIMES = ['الفجر', 'العصر', 'المغرب', 'العشاء'].map((t) => ({ value: t, label: t }));
const TRACKS = (['GOLDEN', 'SILVER', 'TALQEEN'] as const).map((t) => ({ value: t, label: TRACK_AR[t] }));

const blank = (): Halaqa => ({
  id: Math.random().toString(36).slice(2, 10),
  name: '', teacher: '', mosque: 'جامع محمد العبدالكريم — حي أُحد',
  timeSlot: 'العصر', track: null, notes: '',
});

export function HalaqaDialog({ open, halaqa, onClose }:
  { open: boolean; halaqa: Halaqa | null; onClose: () => void }) {
  const db = useDB();
  const [f, setF] = useState<Halaqa>(blank);
  const [applyTrack, setApplyTrack] = useState(true);
  useEffect(() => { if (open) { setF(halaqa ? { ...halaqa } : blank()); setApplyTrack(true); } }, [open, halaqa]);

  const students = db.students.filter((s) => s.halaqaId === f.id);
  const isNew = !halaqa;
  const trackChanged = !!f.track && f.track !== halaqa?.track;
  const offTrack = f.track ? students.filter((s) => s.track !== f.track).length : 0;

  const save = () => {
    const name = f.name.trim() || (f.teacher.trim() ? `تحفيظ ${f.teacher.trim()} (${f.timeSlot})` : '');
    if (!name || !f.teacher.trim()) return;
    store.upsertHalaqa({ ...f, name });
    /* A halaqa runs one track, so setting it here can carry to its students
       instead of being repeated on each one. Opt-out, never silent. */
    if (f.track && applyTrack && offTrack > 0) {
      store.setTrackForHalaqa(f.id, f.track);
    }
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
            placeholder="حسن محمد ماهر علي" autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المسار" hint="الحلقة تسير على مسار واحد">
            <Combobox value={f.track ?? ''} onChange={(v) => setF({ ...f, track: (v || null) as Track | null })}
              options={[{ value: '', label: '— غير محدّد —' }, ...TRACKS]} placeholder="اختر المسار" />
          </Field>
          <Field label="الوقت">
            <Combobox value={f.timeSlot} onChange={(v) => setF({ ...f, timeSlot: v })} options={TIMES} />
          </Field>
        </div>

        <Field label="اسم الحلقة" hint="اتركه فارغًا ليُشتقّ من اسم المعلّم والوقت">
          <input className={INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder={f.teacher ? `تحفيظ ${f.teacher} (${f.timeSlot})` : 'تحفيظ … (العصر)'} />
        </Field>

        <Field label="ملاحظات">
          <input className={INPUT} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>

        {!isNew && f.track && offTrack > 0 && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-brand-50 px-3 py-3 text-panel">
            <input type="checkbox" checked={applyTrack} onChange={(e) => setApplyTrack(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-ink-300 accent-brand-800" />
            <span className="text-ink-700">
              تطبيق مسار <strong className="text-brand-800">{TRACK_AR[f.track]}</strong> على{' '}
              <Num className="font-medium text-ink-900">{offTrack}</Num> من طلاب الحلقة الذين يخالفونه.
            </span>
          </label>
        )}

        {!isNew && (
          <p className="rounded-lg bg-page px-3 py-2.5 text-panel text-ink-600">
            في هذه الحلقة <Num className="font-medium text-ink-900">{students.length}</Num> طالبًا.
            حذف الحلقة يفصلهم عنها ولا يحذف أحدًا.
          </p>
        )}
      </div>
    </Modal>
  );
}
