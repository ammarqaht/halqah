'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Btn, Field, INPUT, INPUT_BARE } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { cx } from '@/lib/cx';
import { store, useDB } from '@/lib/store';
import { ALL_GRADES, BASE_NATIONALITIES, GRADES_BY_STAGE, STAGES, STATUS_AR, TRACK_AR, levelsFor, type Student, type StudentStatus, type Track } from '@/lib/types';
import { normalisePhone, normaliseNationalId, shortName } from '@/lib/normalise';
import { Num } from '@/components/Num';

const blank = (halaqaId: string | null, track: Track | null = null): Student => ({
  id: Math.random().toString(36).slice(2, 10),
  fullName: '', nationalId: null, nationalIdFlag: null, track,
  halaqaId, grade: '', stage: '', nationality: '', guardianPhone: '',
  birthDate: null, status: 'ACTIVE', currentLevel: null,
});

/* ── تاريخ الميلاد ──────────────────────────────────────────────────────────
   «أضف خانة تاريخ الميلاد وتكون ثلاث خانات (اليوم — الشهر — السنة) بالميلادي،
   والشهر يكون في قائمة منسدلة قابلة للبحث بالاسم أو الكتابة بالرقم» (client,
   18 Sep 2026).

   Three boxes rather than one calendar, because this is the one date on the
   screen nobody PICKS: it is copied off a card, and a calendar asks whoever
   is typing to walk back a hundred and fifty months to reach 2013. The month
   is the box that goes wrong — «٠٣» and «مارس» and «٣» are the same month and
   only one of them sorts — so it is chosen from the twelve, by name or by its
   number, and stored as a number either way. */
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** How long a Gregorian month is — February cannot be answered without the year. */
const daysIn = (m: number, y: number) =>
  m === 2 ? (((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28)
    : ([4, 6, 9, 11].includes(m) ? 30 : 31);

/** Whole years to today — shown, never stored. */
function ageOn(iso: string): number | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const had = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  if (!had) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function BirthDate({ value, onChange }: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
}) {
  const [day, setDay] = useState(() => (value ? String(Number(value.slice(8, 10))) : ''));
  const [month, setMonth] = useState(() => (value ? value.slice(5, 7) : ''));
  const [year, setYear] = useState(() => (value ? value.slice(0, 4) : ''));

  /* A date is only a date when all three are there. Anything short of that is
     half-typed, not «no birthday» — so it is held on the screen and reported
     upward as nothing, rather than saved as a third of a date. */
  const push = (d: string, m: string, y: string) => {
    const dd = Number(d), mm = Number(m), yy = Number(y);
    if (!dd || !mm || y.length !== 4 || !yy) { onChange(null); return; }
    onChange(`${yy}-${pad2(mm)}-${pad2(Math.min(dd, daysIn(mm, yy)))}`);
  };

  const age = value ? ageOn(value) : null;

  return (
    <Field label="تاريخ الميلاد"
      hint={age != null ? `عمره اليوم ${age} سنة` : 'ميلادي — اليوم والشهر والسنة'}>
      <div className="flex items-center gap-2">
        <input value={day} inputMode="numeric" dir="ltr" aria-label="اليوم" placeholder="اليوم"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 2);
            setDay(v); push(v, month, year);
          }}
          className={`${INPUT_BARE} h-11 w-16 text-center`} />
        <div className="min-w-0 flex-1">
          <Combobox value={month} placeholder="الشهر" searchPlaceholder="بالاسم أو بالرقم…"
            emptyText="لا شهر بهذا الاسم"
            onChange={(v) => { setMonth(v); push(day, v, year); }}
            options={MONTHS.map((label, i) => ({
              value: pad2(i + 1), label, hint: String(i + 1),
            }))} />
        </div>
        <input value={year} inputMode="numeric" dir="ltr" aria-label="السنة" placeholder="السنة"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
            setYear(v); push(day, month, v);
          }}
          className={`${INPUT_BARE} h-11 w-20 text-center`} />
      </div>
    </Field>
  );
}

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

        {/* Keyed on the student, so opening the dialog on another boy starts
            the three boxes from HIS date rather than from the last one read. */}
        <div className="sm:col-span-2">
          <BirthDate key={f.id} value={f.birthDate}
            onChange={(iso) => setF((p) => ({ ...p, birthDate: iso }))} />
        </div>

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

        {/* A boy who stops coming is marked, never deleted. His exams, his
            level and his points stay exactly where they are — so the day he
            comes back there is nothing to re-enter — and the statistics stop
            counting him, because they describe the halaqa as it is today. */}
        <Field label="الحالة"
          hint={f.status === 'ACTIVE'
            ? 'يُحتسب في الإحصاءات والكشوف'
            : 'خارج الإحصاءات — وبياناته كلها محفوظة كما هي'}>
          <div className="flex flex-wrap gap-2">
            {(['ACTIVE', 'INACTIVE', 'GRADUATED'] as StudentStatus[]).map((st) => (
              <button key={st} type="button" onClick={() => setF({ ...f, status: st })}
                className={cx('rounded-lg border px-3.5 py-2 text-body transition-colors',
                  f.status === st
                    ? st === 'ACTIVE' ? 'border-ok-700 bg-ok-100 font-medium text-ok-700'
                      : st === 'INACTIVE' ? 'border-warn-700 bg-warn-100 font-medium text-warn-700'
                      : 'border-brand-700 bg-brand-50 font-medium text-brand-900'
                    : 'border-ink-200 bg-paper text-ink-700 hover:border-ink-300')}>
                {STATUS_AR[st]}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
