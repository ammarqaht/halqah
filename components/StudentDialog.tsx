'use client';
import { useEffect, useState } from 'react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
import { store, useDB } from '@/lib/store';
import { TRACK_AR, STATUS_AR, type Student, type Track, type StudentStatus } from '@/lib/types';
import { normalisePhone, normaliseNationalId } from '@/lib/normalise';

const blank = (halaqaId: string | null): Student => ({
  id: Math.random().toString(36).slice(2, 10),
  fullName: '', nationalId: null, nationalIdFlag: null, track: 'SILVER',
  halaqaId, grade: '', stage: '', nationality: 'سعودي', guardianPhone: '',
  status: 'ACTIVE', currentLevel: null,
});

export function StudentDialog({ open, student, defaultHalaqa, onClose }:
  { open: boolean; student: Student | null; defaultHalaqa: string | null; onClose: () => void }) {
  const db = useDB();
  const [f, setF] = useState<Student>(() => blank(defaultHalaqa));
  useEffect(() => { if (open) setF(student ? { ...student } : blank(defaultHalaqa)); }, [open, student, defaultHalaqa]);

  const save = () => {
    if (!f.fullName.trim()) return;
    const { id, flag } = normaliseNationalId(f.nationalId);
    store.upsertStudent({
      ...f, fullName: f.fullName.trim(), nationalId: id, nationalIdFlag: flag,
      guardianPhone: normalisePhone(f.guardianPhone),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide
      title={student ? `تعديل بيانات ${student.fullName}` : 'إضافة طالب'}
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" onClick={save}>حفظ</Btn></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="اسم الطالب">
            <input className={INPUT} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })}
              placeholder="الاسم الكامل" />
          </Field>
        </div>
        <Field label="رقم الهوية" hint="يُدخل كما هو — لا يُتحقّق من عدد الخانات">
          <input className={`${INPUT} num`} dir="ltr" inputMode="numeric" value={f.nationalId ?? ''}
            onChange={(e) => setF({ ...f, nationalId: e.target.value })} />
        </Field>
        <Field label="جوال ولي الأمر">
          <input className={`${INPUT} num`} dir="ltr" inputMode="numeric" value={f.guardianPhone}
            onChange={(e) => setF({ ...f, guardianPhone: e.target.value })} />
        </Field>
        <Field label="الحلقة" hint="يمكن نقله لاحقًا دون فقد تاريخه">
          <select className={INPUT} value={f.halaqaId ?? ''}
            onChange={(e) => setF({ ...f, halaqaId: e.target.value || null })}>
            <option value="">— بلا حلقة —</option>
            {db.halaqat.map((h) => <option key={h.id} value={h.id}>{h.teacher} · {h.timeSlot}</option>)}
          </select>
        </Field>
        <Field label="المسار">
          <select className={INPUT} value={f.track ?? ''}
            onChange={(e) => setF({ ...f, track: (e.target.value || null) as Track | null })}>
            <option value="">—</option>
            {(['GOLDEN', 'SILVER', 'TALQEEN'] as const).map((t) => <option key={t} value={t}>{TRACK_AR[t]}</option>)}
          </select>
        </Field>
        <Field label="الصف الدراسي">
          <input className={INPUT} value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} />
        </Field>
        <Field label="المرحلة">
          <input className={INPUT} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })} />
        </Field>
        <Field label="الجنسية">
          <select className={INPUT} value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })}>
            <option>سعودي</option><option>غير سعودي</option>
          </select>
        </Field>
        <Field label="الحالة">
          <select className={INPUT} value={f.status}
            onChange={(e) => setF({ ...f, status: e.target.value as StudentStatus })}>
            {(['ACTIVE', 'INACTIVE', 'GRADUATED'] as const).map((s) => <option key={s} value={s}>{STATUS_AR[s]}</option>)}
          </select>
        </Field>
      </div>
      {f.track === 'TALQEEN' && (
        <p className="mt-4 rounded-lg bg-info-100 px-3 py-2.5 text-panel text-info-700">
          طلاب التلقين خارج نظام النقاط والمتجر، ولا تُطبع لهم خطة حفظ ولا يُسنَد لهم مستوى — القرار المعتمد رقم ١.
        </p>
      )}
    </Modal>
  );
}
