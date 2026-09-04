'use client';
/* تسجيل اختبار — SPEC.md §6.8, approved PDF §9 (إد-٥-ب).
   «شاشة إدخال واحدة تُغني عن ملف الاختبارات، وتُحدّث كل الشاشات فور الحفظ».

   The fields are his file's fields, in his order. What the screen adds is the
   arithmetic he does by hand today: the halaqa and track fill themselves from
   the student, the juz count from the level, the score from the counters, the
   pass from the score, and the points from the table in §8 — every one of them
   a **suggestion** he can overrule, because §11 is explicit that «النظام
   يقترح، وأنت تقرّر».

   The one thing that is not a suggestion is the join to the ledger: ticking
   «صُرفت» writes the points movement in the same commit as the exam, so there
   is «لا سجلّ منفصل ولا نسيان». */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck, AlertTriangle, ArrowRight, Check, Coins, FileText, Plus,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num, pointWord } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { earnsPoints, examPoints, EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import {
  ajzaForLevel, isMidJuz, scoreFromCounters, isPassingFor, scoreMax, passMarkFor,
  suggestionAfter,
} from '@/lib/exams';
import { type Exam } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { isoDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

const TYPES: ExamType[] = ['BADGE_GOLDEN', 'BADGE_DIAMOND', 'ASSOCIATION', 'MOCK', 'TAJWEED'];

/* Silver runs 60→1 and Golden 30→1, so 60 is the widest a level can be and 1
   the narrowest. The track's own ceiling is tighter than this and is warned
   about separately — a warning rather than a block, because the supervisor may
   be recording history from a file whose numbers we cannot second-guess. */
const LEVEL_MIN = 1;
const LEVEL_MAX = 60;
const TRACK_MAX_LEVEL: Record<string, number> = { SILVER: 60, GOLDEN: 30 };

/** Keep a typed figure inside its bounds as it is typed, not after the fact. */
function clampDigits(raw: string, max: number, opts: { decimal?: boolean } = {}) {
  const cleaned = opts.decimal
    ? raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
    : raw.replace(/[^\d]/g, '');
  if (cleaned === '' || cleaned === '.') return cleaned;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return '';
  return n > max ? String(max) : cleaned;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type Saved = { exam: Exam; studentName: string; nextLevel: number | null };

export default function RecordExam() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const router = useRouter();

  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState<ExamType>('BADGE_GOLDEN');
  const [takenOn, setTakenOn] = useState(isoDate(new Date()));
  const [level, setLevel] = useState('');
  const [ajza, setAjza] = useState('');
  const [errors, setErrors] = useState('');
  const [warnings, setWarnings] = useState('');
  const [tajweedErrors, setTajweedErrors] = useState('');
  /** Null while the score is following the counters; a number once he types. */
  const [scoreOverride, setScoreOverride] = useState<string | null>(null);
  const [passOverride, setPassOverride] = useState<boolean | null>(null);
  const [pointsOverride, setPointsOverride] = useState<string | null>(null);
  const [pointsPaid, setPointsPaid] = useState(true);
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [examiner, setExaminer] = useState('');
  const [saved, setSaved] = useState<Saved | null>(null);

  const student = db.students.find((s) => s.id === studentId) ?? null;
  const halaqa = student?.halaqaId ? db.halaqat.find((h) => h.id === student.halaqaId) ?? null : null;
  const blocked = student ? !earnsPoints(student) : false;

  /* ── the chain of suggestions ─────────────────────────────────────────────
     Each link fills itself from the one before it and stays editable. */

  // level ← the student's current level
  useEffect(() => {
    if (!student) return;
    setLevel(student.currentLevel !== null ? String(student.currentLevel) : '');
  }, [student]);

  const levelNum = level === '' ? null : Number(level);
  const suggestedAjza = useMemo(
    () => ajzaForLevel(student?.track ?? null, levelNum), [student, levelNum]);

  // ajza ← the level, via §4.2
  useEffect(() => {
    setAjza(suggestedAjza !== null ? String(suggestedAjza) : '');
  }, [suggestedAjza]);

  const counts = {
    errors: Number(errors) || 0,
    warnings: Number(warnings) || 0,
    tajweedErrors: Number(tajweedErrors) || 0,
  };
  const anyCounter = errors !== '' || warnings !== '' || tajweedErrors !== '';

  /* Tajweed is entered out of 10 and has no error counters in the client's
     sheet, so the computed score only applies to the other four types. */
  const computedScore = type === 'TAJWEED' || !anyCounter ? null : scoreFromCounters(counts);
  const score = scoreOverride !== null && scoreOverride !== ''
    ? Number(scoreOverride)
    : computedScore;

  const suggestedPass = score !== null ? isPassingFor(type, score) : null;
  const passed = passOverride ?? suggestedPass;

  const suggestedPoints = useMemo(() => {
    if (!student || blocked) return 0;
    if (passed !== true) return 0;               // points follow a pass, §9
    return examPoints(student.track, type);      // null ⇒ TAJWEED, he types it
  }, [student, blocked, passed, type]);

  const points = pointsOverride !== null && pointsOverride !== ''
    ? Number(pointsOverride)
    : (suggestedPoints ?? 0);

  // a type change invalidates every override downstream of it
  useEffect(() => {
    setScoreOverride(null); setPassOverride(null); setPointsOverride(null);
  }, [type]);

  /* Talqeen students are not offered at all. They have no level and no
     curriculum (§13.1), so a levelled exam on one of them is not a mistake to
     warn about after the fact — it is a choice that should never be on the
     list. The count of who was left out is stated below the field instead. */
  const eligible = useMemo(() => db.students.filter(earnsPoints), [db.students]);
  const talqeenCount = db.students.length - eligible.length;

  const studentOptions = useMemo(() => eligible.map((s) => ({
    value: s.id,
    label: s.fullName,
    hint: [s.halaqaId ? shortName(db.halaqat.find((h) => h.id === s.halaqaId)?.teacher ?? '') : 'بلا حلقة',
           s.currentLevel !== null ? `المستوى ${s.currentLevel}` : 'بلا مستوى'].filter(Boolean).join(' · '),
  })).sort((a, b) => a.label.localeCompare(b.label, 'ar')), [eligible, db.halaqat]);

  const topicOptions = db.tajweedTopics.filter((t) => t.active)
    .map((t) => ({ value: t.name, label: t.name }));

  /* Level and juz come straight from the database when a student is chosen, and
     the record is worthless without them: the level is what tells us later which
     levels he has been examined on, and the juz count is what §4.8 gates
     association readiness on. So they are required, not merely suggested. */
  const levelValid = levelNum !== null && levelNum >= LEVEL_MIN && levelNum <= LEVEL_MAX;
  const ajzaValid = ajza !== '' && Number(ajza) > 0;
  const scoreValid = score !== null && score >= 0 && score <= scoreMax(type);

  const valid = !!student && !blocked && takenOn !== ''
    && (type !== 'TAJWEED' || topic.trim() !== '')
    && levelValid && ajzaValid && scoreValid;

  /** What is still missing, named — a disabled button with no reason is a wall. */
  const missing = !student ? 'اختر الطالب'
    : !levelValid ? `المستوى مطلوب، بين ${LEVEL_MIN} و${LEVEL_MAX}`
    : !ajzaValid ? 'عدد الأجزاء مطلوب'
    : type === 'TAJWEED' && topic.trim() === '' ? 'اختر موضوع التجويد'
    : !scoreValid ? `الدرجة مطلوبة، ولا تتجاوز ${scoreMax(type)}`
    : null;

  const reset = () => {
    setStudentId(''); setType('BADGE_GOLDEN'); setTakenOn(isoDate(new Date()));
    setLevel(''); setAjza(''); setErrors(''); setWarnings(''); setTajweedErrors('');
    setScoreOverride(null); setPassOverride(null); setPointsOverride(null);
    setPointsPaid(true); setTopic(''); setNote(''); setExaminer(''); setSaved(null);
  };

  const save = () => {
    if (!valid || !student) return;
    const exam: Exam = {
      id: uid(),
      studentId: student.id,
      halaqaId: student.halaqaId,
      track: student.track,
      type,
      takenOn,
      level: levelNum,
      ajza: ajza === '' ? null : Number(ajza),
      errors: type === 'TAJWEED' ? null : counts.errors,
      warnings: type === 'TAJWEED' ? null : counts.warnings,
      tajweedErrors: type === 'TAJWEED' ? null : counts.tajweedErrors,
      score,
      passed,
      pointsAwarded: Math.max(0, Math.round(points)),
      pointsPaid: pointsPaid && points > 0,
      note: note.trim(),
      examiner: examiner.trim(),
      tajweedTopic: type === 'TAJWEED' ? topic.trim() : null,
      source: 'MANUAL',
      createdAt: new Date().toISOString(),
    };
    store.saveExam(exam);
    const after = suggestionAfter(exam, exam.level);
    setSaved({ exam, studentName: student.fullName, nextLevel: after?.printLevel ?? null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!db.students.length) {
    return (
      <>
        <TopBar title="تسجيل اختبار" crumbs={['الاختبارات']} panelOpen={panelOpen}
          onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={ClipboardCheck} title="لا يوجد طلاب بعد"
              body="الاختبار يُسجَّل على طالب. ارفع ملفاتك من الصفحة الرئيسية أولًا."
              action={<Link href="/admin"><Btn variant="primary" size="lg">الصفحة الرئيسية</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  /* ── what happened after the save — §9's four automatic consequences ────── */
  if (saved) {
    return (
      <>
        <TopBar title="تسجيل اختبار" crumbs={['الاختبارات']} panelOpen={panelOpen}
          onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise border-ok-200 bg-ok-100/40">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok-200 text-ok-700">
                <Check size={20} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-t1 text-ink-900">
                  سُجِّل {EXAM_TYPE_AR[saved.exam.type as ExamType]} للطالب {saved.studentName}
                </h2>
                <p className="mt-1.5 text-base2 text-ink-700">
                  الدرجة <Num className="font-medium">{saved.exam.score}</Num> من{' '}
                  <Num>{scoreMax(saved.exam.type)}</Num> ·{' '}
                  {saved.exam.passed
                    ? <span className="font-medium text-ok-700">اجتاز</span>
                    : <span className="font-medium text-risk-700">لم يجتز</span>}
                  {saved.exam.pointsPaid && saved.exam.pointsAwarded > 0 && (
                    <> · أُضيفت <Num className="font-medium text-brand-800">{saved.exam.pointsAwarded}</Num>{' '}
                      {pointWord(saved.exam.pointsAwarded)} إلى رصيده</>
                  )}
                </p>
                {saved.exam.passed && saved.exam.pointsAwarded > 0 && !saved.exam.pointsPaid && (
                  <p className="mt-1 text-panel text-warn-700">
                    لم تُصرف نقاطه بعد — يظهر في تنبيه «اجتاز ولم تُصرف نقاطه».
                  </p>
                )}

                {/* «اجتاز ٢٦، المفروض أطبع له ٢٥» — his own sentence, §9 */}
                {saved.nextLevel !== null && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
                    <FileText size={17} className="shrink-0 text-brand-800" />
                    <p className="min-w-0 flex-1 text-base2 text-ink-800">
                      اجتاز المستوى <Num className="font-medium">{saved.exam.level}</Num>، فالمفروض
                      أن تطبع له المستوى <Num className="font-medium text-brand-800">{saved.nextLevel}</Num>.
                    </p>
                    <Link href="/admin/plans"><Btn size="sm">طباعة الخطة</Btn></Link>
                  </div>
                )}

                {/* A passed GOLDEN badge does not advance anyone, so it gets no
                    print offer — §13.8: «الذهبي عند نصف المستوى، والماسي عند
                    المستوى كاملًا **ثم ينتقل الطالب إلى الجزء التالي**». Saying
                    so is better than saying nothing: without a line here the
                    supervisor is left wondering why the offer did not appear. */}
                {saved.exam.type === 'BADGE_GOLDEN' && saved.exam.passed && (
                  <p className="mt-3 rounded-lg bg-info-100 px-3.5 py-2.5 text-panel text-info-700">
                    الوسام الذهبي عند نصف المستوى، فلا ينتقل به الطالب —
                    يبقى على المستوى <Num className="font-medium">{saved.exam.level}</Num> حتى
                    يجتاز الوسام الماسي في اليوم الرابع والعشرين، وعندها تُطبع له ورقة المستوى التالي.
                  </p>
                )}

                {saved.exam.type === 'ASSOCIATION' && (
                  <p className="mt-3 text-panel text-ink-600">
                    اختبار جمعية — سيظهر الطالب مظلَّلًا في تقرير معلّمه.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Btn variant="primary" icon={Plus} onClick={reset}>سجّل اختبارًا آخر</Btn>
                  <Btn icon={ArrowRight} onClick={() => router.push('/admin/exams')}>سجلّ الاختبارات</Btn>
                </div>
              </div>
            </div>
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="تسجيل اختبار" crumbs={['الاختبارات']}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={<Link href="/admin/exams"><Btn>سجلّ الاختبارات</Btn></Link>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <Sheet className="rise mb-4">
          <SheetHead title="الطالب والاختبار"
            meta="اختر الطالب، فتظهر حلقته ومساره ومستواه من نفسها" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم الطالب"
              hint={talqeenCount > 0
                ? `${talqeenCount} من طلاب التلقين خارج هذه القائمة — لا مستوى لهم ولا منهج`
                : 'ابحث بالاسم'}>
              <Combobox value={studentId} onChange={setStudentId} options={studentOptions}
                placeholder="اختر الطالب" searchPlaceholder="ابحث بالاسم…"
                emptyText="لا طالب بهذا الاسم" />
            </Field>
            <Field label="التاريخ" hint="تاريخ اليوم افتراضيًا">
              <input type="date" className={INPUT} value={takenOn}
                onChange={(e) => setTakenOn(e.target.value)} />
            </Field>
          </div>

          {/* what the student brings with him — filled, not asked */}
          {student && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-page px-4 py-3 text-panel">
              <span className="text-ink-600">الحلقة{' '}
                <span className="font-medium text-ink-900">{halaqa ? shortName(halaqa.teacher) : 'بلا حلقة'}</span>
              </span>
              <span className="text-ink-600">المعلّم{' '}
                <span className="font-medium text-ink-900">{halaqa?.teacher ?? '—'}</span>
              </span>
              <span className="text-ink-600">المسار{' '}
                <span className="font-medium text-ink-900">
                  {student.track ? { SILVER: 'فضي', GOLDEN: 'ذهبي', TALQEEN: 'تلقين' }[student.track] : '—'}
                </span>
              </span>
            </div>
          )}

          {blocked && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-risk-200 bg-risk-100 px-4 py-3">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-risk-700" />
              <p className="text-base2 text-risk-700">
                هذا الطالب على مسار التلقين، ولا مستوى له ولا منهج — فلا تُسجَّل عليه اختبارات
                مستوياتية ولا نقاط — القرار الأول في القسم ١٣ من الوثيقة.
              </p>
            </div>
          )}
        </Sheet>

        {student && !blocked && (
          <>
            <Sheet className="rise mb-4">
              <SheetHead title="نوع الاختبار" />
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button key={t} onClick={() => setType(t)}
                    className={cx('rounded-lg border px-3.5 py-2 text-body transition-colors',
                      type === t
                        ? 'border-brand-700 bg-brand-50 font-medium text-brand-800'
                        : 'border-ink-200 text-ink-700 hover:border-ink-300 hover:bg-page')}>
                    {EXAM_TYPE_AR[t]}
                  </button>
                ))}
              </div>
              {type === 'MOCK' && (
                <p className="mt-3 rounded-lg bg-info-100 px-3.5 py-2.5 text-panel text-info-700">
                  الاختبار التجريبي بروفة قبل الجمعية، ولا نقاط عليه — القرار الثامن في القسم ١٣ من الوثيقة.
                </p>
              )}
              {type === 'TAJWEED' && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="موضوع التجويد" hint="تُضيف مواضيع جديدة من الإعدادات">
                    <Combobox value={topic} onChange={setTopic} options={topicOptions}
                      creatable createLabel="موضوع جديد"
                      placeholder="اختر الموضوع" emptyText="لا مواضيع بعد" />
                  </Field>
                </div>
              )}
            </Sheet>

            <Sheet className="rise mb-4">
              <SheetHead title="المستوى والدرجة"
                meta={type === 'TAJWEED'
                  ? 'اختبار التجويد يُسجَّل بدرجة من ١٠ كما في ملفكم'
                  : 'الدرجة تُحسب من العدّادات، وتبقى قابلة للتعديل'} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="المستوى · مطلوب"
                  hint={`من قاعدة البيانات — بين ${LEVEL_MIN} و${LEVEL_MAX}`}>
                  <input className={cx(INPUT, !levelValid && level !== '' && 'border-risk-500')}
                    inputMode="numeric" value={level}
                    onChange={(e) => setLevel(clampDigits(e.target.value, LEVEL_MAX))} />
                </Field>
                <Field label="عدد الأجزاء · مطلوب"
                  hint={isMidJuz(student.track, levelNum)
                    ? 'هذا المستوى في منتصف جزء، فاكتب العدد بنفسك'
                    : 'يُقترح من المستوى، وقابل للتعديل'}>
                  <input className={cx(INPUT, !ajzaValid && ajza !== '' && 'border-risk-500')}
                    inputMode="numeric" value={ajza}
                    onChange={(e) => setAjza(clampDigits(e.target.value, 30))} />
                </Field>
              </div>

              {/* The track's own ceiling is tighter than 60. A warning, not a
                  block: he may be entering history from a file we cannot judge. */}
              {levelValid && student.track && levelNum !== null
                && levelNum > (TRACK_MAX_LEVEL[student.track] ?? LEVEL_MAX) && (
                <p className="mt-3 rounded-lg bg-warn-100 px-3.5 py-2.5 text-panel text-warn-700">
                  المسار {student.track === 'GOLDEN' ? 'الذهبي' : 'الفضي'} ينتهي عند المستوى{' '}
                  <Num className="font-medium">{TRACK_MAX_LEVEL[student.track]}</Num>، فراجع الرقم قبل الحفظ.
                </p>
              )}

              {isMidJuz(student.track, levelNum) && (
                <p className="mt-3 rounded-lg bg-info-100 px-3.5 py-2.5 text-panel text-info-700">
                  المستوى <Num className="font-medium">{levelNum}</Num> في المسار الفضي يقع في منتصف جزء،
                  فلا يقابله عدد أجزاء صحيح — اكتب العدد الذي اختُبر عليه.
                </p>
              )}

              {type !== 'TAJWEED' && (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {([
                    ['عدد الأخطاء', errors, setErrors, '٢ درجة لكل خطأ'],
                    ['التنبيهات', warnings, setWarnings, 'نصف درجة لكل تنبيه'],
                    ['الأخطاء التجويدية', tajweedErrors, setTajweedErrors, 'درجة واحدة لكل خطأ'],
                  ] as const).map(([label, val, set, hint]) => (
                    <Field key={label} label={label} hint={hint}>
                      <input className={INPUT} inputMode="numeric" value={val} placeholder="0"
                        onChange={(e) => { set(e.target.value.replace(/[^\d]/g, '')); setScoreOverride(null); }} />
                    </Field>
                  ))}
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={`الدرجة النهائية من ${scoreMax(type)}`}
                  hint={computedScore !== null && scoreOverride === null
                    ? 'محسوبة من العدّادات — اكتب فوقها لتتجاوزها'
                    : undefined}>
                  <input className={INPUT} inputMode="decimal"
                    value={scoreOverride ?? (computedScore !== null ? String(computedScore) : '')}
                    onChange={(e) => {
                      setScoreOverride(clampDigits(e.target.value, scoreMax(type), { decimal: true }));
                      setPassOverride(null);
                    }}
                    placeholder={type === 'TAJWEED' ? '٨' : '١٠٠'} />
                </Field>

                <div>
                  <span className="mb-1.5 block text-xs2 font-medium text-ink-600">النتيجة</span>
                  <div className="inline-flex rounded-md border border-ink-200 bg-paper p-0.5">
                    {([[true, 'اجتاز'], [false, 'لم يجتز']] as const).map(([v, label]) => (
                      <button key={label} type="button" onClick={() => setPassOverride(v)}
                        className={cx('h-9 rounded px-4 text-body font-medium transition-colors',
                          passed === v
                            ? (v ? 'bg-ok-100 text-ok-700' : 'bg-risk-100 text-risk-700')
                            : 'text-ink-600 hover:bg-ink-100')}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-micro text-ink-500">
                    {score === null
                      ? 'أدخل الدرجة أولًا'
                      : passOverride === null
                        ? `مقترحة من الدرجة — حدّ النجاح ${passMarkFor(type)}`
                        : 'تجاوزتَ الاقتراح يدويًا'}
                  </p>
                </div>
              </div>
            </Sheet>

            <Sheet className="rise mb-4">
              <SheetHead title="نقاط التحفيز"
                meta="تُقترح من جدول القسم الثامن حسب نوع الاختبار ومسار الطالب" />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="النقاط"
                  hint={suggestedPoints === null
                    ? 'اختبار التجويد يأخذ رقمًا حرًّا كما في ملفكم'
                    : passed !== true ? 'لا نقاط دون اجتياز' : undefined}>
                  <input className={INPUT} inputMode="numeric"
                    value={pointsOverride ?? String(suggestedPoints ?? '')}
                    onChange={(e) => setPointsOverride(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="0" />
                </Field>

                <label className={cx('flex cursor-pointer items-start gap-2.5 self-end rounded-lg px-3.5 py-3 text-panel transition-colors',
                  pointsPaid && points > 0 ? 'bg-brand-50' : 'bg-page')}>
                  <input type="checkbox" checked={pointsPaid} disabled={points <= 0}
                    onChange={(e) => setPointsPaid(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-ink-300 accent-brand-800 disabled:opacity-40" />
                  <span className="text-ink-700">
                    <strong className="text-ink-900">صُرفت.</strong>{' '}
                    {points > 0
                      ? <>تُضاف <Num className="font-medium text-brand-800">{points}</Num>{' '}
                          {pointWord(points)} إلى رصيده مع الحفظ، في الحركة نفسها.</>
                      : 'لا نقاط على هذا الاختبار.'}
                  </span>
                </label>
              </div>
            </Sheet>

            <Sheet className="rise mb-4">
              <SheetHead title="ملاحظات" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ملاحظة" hint="نصّ حرّ، مثل «عنده ضعف في المدّ»">
                  <input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <Field label="اسم المختبِر" hint="خاصةً في اختبارات الجمعية">
                  <input className={INPUT} value={examiner} onChange={(e) => setExaminer(e.target.value)} />
                </Field>
              </div>
            </Sheet>

            <div className="rise sticky bottom-0 -mx-6 flex items-center justify-between gap-4 border-t border-ink-150 bg-page/90 px-6 py-3.5 backdrop-blur-md">
              <p className="text-panel text-ink-500">
                {valid
                  ? <>جاهز للحفظ{points > 0 && pointsPaid && <> — ومعه <Coins size={13} className="inline" />{' '}
                      <Num className="font-medium text-brand-800">{points}</Num> {pointWord(points)}</>}</>
                  : missing}
              </p>
              <Btn variant="primary" size="lg" icon={Check} onClick={save} disabled={!valid}>
                حفظ الاختبار
              </Btn>
            </div>
          </>
        )}
      </div>
    </>
  );
}
