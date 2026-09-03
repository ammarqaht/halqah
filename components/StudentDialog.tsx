'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { store, useDB } from '@/lib/store';
import { ALL_GRADES, BASE_NATIONALITIES, GRADES_BY_STAGE, STAGES, TRACK_AR, type Student } from '@/lib/types';
import { normalisePhone, normaliseNationalId, shortName } from '@/lib/normalise';
import { Num } from '@/components/Num';

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

  const stages = useMemo(
    () => STAGES.map((n) => ({ value: n, label: n })),
    []);

  /* The grades on offer follow the stage — a متوسط student cannot be in
     «خامس ابتدائي». With no stage chosen yet, offer them all. */
  const grades = useMemo(() => {
    const list = GRADES_BY_STAGE[f.stage] ?? ALL_GRADES;
    return list.map((g) => ({ value: g, label: g }));
  }, [f.stage]);

  /* Changing the stage drops a grade that no longer belongs to it, rather than
     leaving «خامس ابتدائي» sitting under «ثانوي». */
  const setStage = (stage: string) => {
    const allowed = GRADES_BY_STAGE[stage] ?? [];
    setF((p) => ({ ...p, stage, grade: allowed.includes(p.grade) ? p.grade : '' }));
  };

  const halaqaOptions = useMemo(() => [
    { value: '', label: '— بلا حلقة —' },
    ...db.halaqat.map((h) => ({
      value: h.id,
      label: shortName(h.teacher),
      hint: h.track ? TRACK_AR[h.track] : h.timeSlot,
    })),
  ], [db.halaqat]);

  const halaqa = db.halaqat.find((h) => h.id === f.halaqaId) ?? null;

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!f.fullName.trim()) return;
    setSaving(true); setErr('');
    const { id, flag } = normaliseNationalId(f.nationalId);
    try {
      await store.upsertStudent({
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'تعذّر الحفظ');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide
      title={student ? `تعديل بيانات ${student.fullName}` : 'إضافة طالب'}
      footer={<>
        <Btn onClick={onClose} disabled={saving}>إلغاء</Btn>
        <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</Btn>
      </>}>
      {err && <p role="alert" className="mb-4 rounded-md border border-risk-200 bg-risk-100 px-3 py-2.5 text-panel text-risk-700">{err}</p>}
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
        <Field label="المرحلة">
          <Combobox value={f.stage} onChange={setStage} options={stages} placeholder="اختر المرحلة" />
        </Field>

        <Field label="الصف الدراسي" hint={f.stage ? undefined : 'اختر المرحلة أولًا لتضيق القائمة'}>
          <Combobox value={f.grade} onChange={(v) => setF({ ...f, grade: v })}
            options={grades} placeholder="اختر الصف" />
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
