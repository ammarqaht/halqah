'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { store, useDB } from '@/lib/store';
import { BASE_NATIONALITIES, TRACK_AR, type Student } from '@/lib/types';
import { normalisePhone, normaliseNationalId, shortName } from '@/lib/normalise';
import { Num } from '@/components/Num';

const STAGES = ['تلقين', 'ابتدائي', 'متوسط', 'ثانوي'];

const blank = (halaqaId: string | null): Student => ({
  id: Math.random().toString(36).slice(2, 10),
  fullName: '', nationalId: null, nationalIdFlag: null, track: null,
  halaqaId, grade: '', stage: '', nationality: '', guardianPhone: '',
  status: 'ACTIVE', currentLevel: null,
});

export function StudentDialog({ open, student, defaultHalaqa, onClose }:
  { open: boolean; student: Student | null; defaultHalaqa: string | null; onClose: () => void }) {
  const db = useDB();
  const [f, setF] = useState<Student>(() => blank(defaultHalaqa));
  useEffect(() => { if (open) setF(student ? { ...student } : blank(defaultHalaqa)); }, [open, student, defaultHalaqa]);

  /* Nationalities already in the data, plus the known list. Whatever the
     supervisor types once is offered from then on. */
  const nationalities = useMemo(() => {
    const seen = new Set<string>(BASE_NATIONALITIES);
    for (const s of db.students) if (s.nationality) seen.add(s.nationality);
    if (f.nationality) seen.add(f.nationality);
    return [...seen].map((n) => ({ value: n, label: n }));
  }, [db.students, f.nationality]);

  const stages = useMemo(() => {
    const seen = new Set<string>(STAGES);
    for (const s of db.students) if (s.stage) seen.add(s.stage);
    return [...seen].map((n) => ({ value: n, label: n }));
  }, [db.students]);

  const halaqaOptions = useMemo(() => [
    { value: '', label: '— بلا حلقة —' },
    ...db.halaqat.map((h) => ({
      value: h.id,
      label: shortName(h.teacher),
      hint: h.track ? TRACK_AR[h.track] : h.timeSlot,
    })),
  ], [db.halaqat]);

  const halaqa = db.halaqat.find((h) => h.id === f.halaqaId) ?? null;

  const save = () => {
    if (!f.fullName.trim()) return;
    const { id, flag } = normaliseNationalId(f.nationalId);
    store.upsertStudent({
      ...f,
      fullName: f.fullName.trim(),
      nationalId: id,
      nationalIdFlag: flag,
      guardianPhone: normalisePhone(f.guardianPhone),
      /* The track belongs to the halaqa — a halaqa runs one track — so the
         student inherits it instead of being set separately. */
      track: halaqa?.track ?? f.track,
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
              placeholder="الاسم الكامل" autoFocus />
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

        <Field label="الحلقة" hint={halaqa?.track
          ? `مسار الحلقة: ${TRACK_AR[halaqa.track]} — يرثه الطالب`
          : 'يمكن نقله لاحقًا دون فقد تاريخه'}>
          <Combobox value={f.halaqaId ?? ''} onChange={(v) => setF({ ...f, halaqaId: v || null })}
            options={halaqaOptions} placeholder="اختر الحلقة" searchPlaceholder="ابحث باسم المعلّم…" />
        </Field>
        <Field label="الصف الدراسي">
          <input className={INPUT} value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}
            placeholder="أول متوسط" />
        </Field>

        <Field label="المرحلة">
          <Combobox value={f.stage} onChange={(v) => setF({ ...f, stage: v })}
            options={stages} placeholder="اختر المرحلة" />
        </Field>
        <Field label="الجنسية" hint="اكتب جنسية جديدة وستُحفظ في القائمة">
          <Combobox value={f.nationality} onChange={(v) => setF({ ...f, nationality: v })}
            options={nationalities} placeholder="اختر أو اكتب" searchPlaceholder="ابحث أو اكتب جنسية…"
            creatable createLabel="إضافة جنسية" />
        </Field>
      </div>
    </Modal>
  );
}
