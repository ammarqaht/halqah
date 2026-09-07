'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { store, useDB } from '@/lib/store';
import { ALL_GRADES, BASE_NATIONALITIES, GRADES_BY_STAGE, STAGES, TRACK_AR, levelsFor, type Student, type Track } from '@/lib/types';
import { normalisePhone, normaliseNationalId, shortName } from '@/lib/normalise';
import { Num } from '@/components/Num';

const blank = (halaqaId: string | null, track: Track | null = null): Student => ({
  id: Math.random().toString(36).slice(2, 10),
  fullName: '', nationalId: null, nationalIdFlag: null, track,
  halaqaId, grade: '', stage: '', nationality: '', guardianPhone: '',
  status: 'ACTIVE', currentLevel: null,
});

export function StudentDialog({ open, student, defaultHalaqa, onClose }:
  { open: boolean; student: Student | null; defaultHalaqa: string | null; onClose: () => void }) {
  const db = useDB();
  /* Opened from inside a halaqa, a new student starts on that halaqa's default
     track — a suggestion to save typing, and one the supervisor overrides in
     the field below whenever this boy is not on it. */
  const defaultTrack = defaultHalaqa
    ? db.halaqat.find((h) => h.id === defaultHalaqa)?.track ?? null : null;
  const [f, setF] = useState<Student>(() => blank(defaultHalaqa));
  /* Deliberately not keyed on defaultTrack: it follows defaultHalaqa, and
     re-running on it would reset a track the supervisor has just chosen. */
  useEffect(() => {
    if (open) setF(student ? { ...student } : blank(defaultHalaqa, defaultTrack));
  }, [open, student, defaultHalaqa]); // eslint-disable-line react-hooks/exhaustive-deps

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
      hint: h.timeSlot,
    })),
  ], [db.halaqat]);

  /* The track is the student's own. Two students in one halaqa may sit on
     different ones, so it is chosen here and nowhere else. */
  const track = f.track;
  const trackOptions = useMemo(() => [
    { value: '', label: '— غير محدّد —' },
    ...(['GOLDEN', 'SILVER', 'TALQEEN'] as const).map((t) => ({ value: t, label: TRACK_AR[t] })),
  ], []);

  const levels = useMemo(
    () => levelsFor(track).map((n) => ({ value: String(n), label: `المستوى ${n}` })),
    [track]);

  /* Levels belong to a track — silver runs 60→1, golden 30→1, talqeen has
     none — so a level the new track does not contain is dropped rather than
     squeezed into range. The supervisor picks the real one; we do not guess. */
  const setTrack = (v: string) => setF((p) => {
    const next = (v || null) as Track | null;
    const keep = p.currentLevel != null && levelsFor(next).includes(p.currentLevel);
    return { ...p, track: next, currentLevel: keep ? p.currentLevel : null };
  });

  /* The halaqa's track is a suggestion for a student who has none yet — it
     never overwrites a track the student already carries. */
  const setHalaqa = (v: string) => setF((p) => {
    const halaqaId = v || null;
    const suggested = halaqaId ? db.halaqat.find((h) => h.id === halaqaId)?.track ?? null : null;
    return { ...p, halaqaId, track: p.track ?? suggested };
  });

  const save = () => {
    if (!f.fullName.trim()) return;
    const { id, flag } = normaliseNationalId(f.nationalId);
    store.upsertStudent({
      ...f,
      fullName: f.fullName.trim(),
      nationalId: id,
      nationalIdFlag: flag,
      guardianPhone: normalisePhone(f.guardianPhone),
      currentLevel: track === 'TALQEEN' ? null : f.currentLevel,
      track,
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

        <Field label="الحلقة" hint="يمكن نقله لاحقًا دون فقد تاريخه">
          <Combobox value={f.halaqaId ?? ''} onChange={setHalaqa}
            options={halaqaOptions} placeholder="اختر الحلقة" searchPlaceholder="ابحث باسم المعلّم…" />
        </Field>
        <Field label="المسار" hint="مسار الطالب وحده — لا يتبع حلقته">
          <Combobox value={f.track ?? ''} onChange={setTrack}
            options={trackOptions} placeholder="اختر المسار" />
        </Field>

        <Field label="المرحلة">
          <Combobox value={f.stage} onChange={setStage} options={stages} placeholder="اختر المرحلة" />
        </Field>

        <Field label="الصف الدراسي" hint={f.stage ? undefined : 'اختر المرحلة أولًا لتضيق القائمة'}>
          <Combobox value={f.grade} onChange={(v) => setF({ ...f, grade: v })}
            options={grades} placeholder="اختر الصف" />
        </Field>

        {track && track !== 'TALQEEN' && (
          <div className="sm:col-span-2">
            <Field label="المستوى الحالي"
              hint={`المسار ${TRACK_AR[track]} — المستويات تنزل من ${levelsFor(track)[0]} إلى ١`}>
              <Combobox value={f.currentLevel != null ? String(f.currentLevel) : ''}
                onChange={(v) => setF({ ...f, currentLevel: v ? Number(v) : null })}
                options={[{ value: '', label: '— بلا مستوى —' }, ...levels]}
                placeholder="اختر المستوى" searchPlaceholder="اكتب رقم المستوى…" />
            </Field>
          </div>
        )}
        <Field label="الجنسية" hint="اكتب جنسية جديدة وستُحفظ في القائمة">
          <Combobox value={f.nationality} onChange={(v) => setF({ ...f, nationality: v })}
            options={nationalities} placeholder="اختر أو اكتب" searchPlaceholder="ابحث أو اكتب جنسية…"
            creatable createLabel="إضافة جنسية" />
        </Field>
      </div>
    </Modal>
  );
}
