'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { store, useDB } from '@/lib/store';
import { ALL_GRADES, BASE_NATIONALITIES, GRADES_BY_STAGE, STAGES, TRACK_AR, type Student } from '@/lib/types';
import { normalisePhone, normaliseNationalId, shortName } from '@/lib/normalise';
import { Num, toArabicDigits } from '@/components/Num';

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

  /* The track the level will be read against. It comes from the halaqa when
     there is one, exactly as `save` writes it, so the field below cannot offer
     a bound that the saved record then contradicts. */
  const track = halaqa?.track ?? f.track;

  /* «الفضي ٦٠ ← ١ · الذهبي ٣٠ ← ١» §4.1. Both count DOWN, so the ceiling is
     the START of the track, not its end. */
  const maxLevel = track === 'GOLDEN' ? 30 : 60;

  const levelError = (() => {
    if (f.currentLevel === null) return null;             // blank is allowed
    if (!Number.isInteger(f.currentLevel)) return 'المستوى رقم صحيح.';
    if (f.currentLevel < 1 || f.currentLevel > maxLevel) {
      return `المستوى بين ١ و${toArabicDigits(maxLevel)}${
        track ? ` في المسار ${TRACK_AR[track]}` : ''}.`;
    }
    return null;
  })();

  const save = () => {
    if (!f.fullName.trim() || levelError) return;
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
      /* «التلقين بلا مستويات» §13.1. A boy moved INTO Talqeen drops the level
         he was carrying, rather than keeping a number nothing can interpret. */
      currentLevel: track === 'TALQEEN' ? null : f.currentLevel,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide
      title={student ? `تعديل بيانات ${student.fullName}` : 'إضافة طالب'}
      footer={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" onClick={save} disabled={!!levelError}>حفظ</Btn></>}>
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
        {/* Beside the halaqa on purpose: the halaqa gives the track, and the
            track is what says whether 45 is a level at all. */}
        <Field label="المستوى الحالي"
          hint={track === 'TALQEEN' ? undefined
            : track ? `يُكتب وحده عند أول طباعة — ${TRACK_AR[track]}: من ${toArabicDigits(maxLevel)} نزولًا إلى ١`
            : 'اختر الحلقة ليُعرف مساره'}>
          {track === 'TALQEEN' ? (
            /* Not a locked box: «التلقين بلا مستويات» §13.1, and a disabled
               field still reads as a value withheld. There is no value. */
            <p className="flex h-11 items-center rounded-md border border-dashed border-ink-200 px-3.5 text-base2 text-ink-500">
              لا مستوى — مسار التلقين
            </p>
          ) : (
            <>
              <input className={`${INPUT} num`} dir="ltr" inputMode="numeric" placeholder="—"
                value={f.currentLevel ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setF({ ...f, currentLevel: v === '' ? null : Number(v) });
                }} />
              {levelError && (
                <span className="mt-1 block text-micro text-risk-700">{levelError}</span>
              )}
            </>
          )}
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
