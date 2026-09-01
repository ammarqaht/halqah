'use client';
/* الاختبار الداخلي على الشاشة — SPEC.md §6.9, approved PDF §9 (إد-٥-ج).

   The client's two sheets, «حجز اختبار» and «صفحة الاختبار», moved onto the
   screen. And the sentence that governs the whole design:

     «النظام لا يصحّح التسميع — أنتم من يستمع ويحكم. دور النظام أن يعدّ الأخطاء
      ويحسب الدرجة ويحفظ النتيجة، بدل الورقة والقلم والآلة الحاسبة.»

   So the sheet is built for a hand that is busy listening: the counters are
   TAPPED, never typed, the targets are large, and nothing is required before
   the recitation can start. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ClipboardCheck, Plus, Minus, Trash2, Check, X, CalendarPlus, Printer,
  ChevronLeft, AlertTriangle, Inbox, Coins,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Modal, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num, pointWord, plural, juzWord } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { earnsPoints, examPoints, EXAM_TYPE_AR } from '@/lib/points';
import {
  scoreFromCounters, totalCounts, isPassingFor, ajzaForLevel, DEFAULT_EXAM_QUESTIONS,
  SCORE_DEDUCTIONS,
} from '@/lib/exams';
import { BOOKING_STATUS_AR, type ExamBooking, type ExamQuestion } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { isoDate, formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

const BADGES = ['BADGE_GOLDEN', 'BADGE_DIAMOND'] as const;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const blankQuestion = (ownerId: string, seq: number): ExamQuestion => ({
  id: uid(), examId: ownerId, seq,
  surah: '', ayahFrom: '', ayahTo: '',
  errors: 0, warnings: 0, tajweedErrors: 0, note: '',
});

function OnsiteScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();

  const [booking, setBooking] = useState(false);
  const [bStudent, setBStudent] = useState('');
  const [bDate, setBDate] = useState(isoDate(new Date()));
  const [bBadge, setBBadge] = useState<typeof BADGES[number]>('BADGE_GOLDEN');
  const [scoreOverride, setScoreOverride] = useState<string | null>(null);
  const [passOverride, setPassOverride] = useState<boolean | null>(null);
  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const openId = sp.get('booking');
  const open = openId ? db.bookings.find((b) => b.id === openId) ?? null : null;

  const eligible = useMemo(() => db.students.filter(earnsPoints), [db.students]);
  const talqeenCount = db.students.length - eligible.length;

  const nameOf = (id: string) => db.students.find((s) => s.id === id)?.fullName ?? '—';
  const halaqaOf = (id: string) => {
    const s = db.students.find((x) => x.id === id);
    const t = s?.halaqaId ? db.halaqat.find((h) => h.id === s.halaqaId)?.teacher : null;
    return t ? shortName(t) : '—';
  };

  /* ── the day's list ─────────────────────────────────────────────────────── */
  const today = isoDate(new Date());
  const rows = useMemo(() => [...db.bookings]
    .sort((a, b) => (a.scheduledOn === b.scheduledOn
      ? (a.createdAt < b.createdAt ? -1 : 1)
      : (a.scheduledOn < b.scheduledOn ? 1 : -1))), [db.bookings]);
  const todays = rows.filter((b) => b.scheduledOn === today && b.status === 'BOOKED');

  /* ── the sheet ──────────────────────────────────────────────────────────── */
  const student = open ? db.students.find((s) => s.id === open.studentId) ?? null : null;
  const questions = useMemo(
    () => db.examQuestions.filter((q) => q.examId === open?.id).sort((a, b) => a.seq - b.seq),
    [db.examQuestions, open]);

  /* «يبدأ الاختبار بعدد افتراضي تحدّده أنت (خمسة مثلًا)» — laid down the first
     time the sheet is opened, then it is his to grow and shrink. */
  useEffect(() => {
    if (!open || open.status !== 'BOOKED' || questions.length) return;
    store.setQuestions(open.id,
      Array.from({ length: DEFAULT_EXAM_QUESTIONS }, (_, i) => blankQuestion(open.id, i + 1)));
  }, [open, questions.length]);

  const totals = useMemo(() => totalCounts(questions), [questions]);
  const computed = scoreFromCounters(totals);
  const score = scoreOverride !== null && scoreOverride !== '' ? Number(scoreOverride) : computed;
  const suggestedPass = isPassingFor(open?.badge ?? 'BADGE_GOLDEN', score);
  const passed = passOverride ?? suggestedPass;

  const suggestedPoints = student && passed
    ? (examPoints(student.track, open?.badge ?? 'BADGE_GOLDEN') ?? 0) : 0;

  /** «يقترح النظام السور الداخلة في مستواه لتختار منها بدل الكتابة». */
  const surahOptions = useMemo(() => {
    if (!student?.track || open?.level == null) return [];
    const set = new Set<string>();
    for (const d of db.curriculum) {
      if (d.track !== student.track || d.level !== open.level) continue;
      if (d.fromSurah) set.add(d.fromSurah);
      if (d.toSurah) set.add(d.toSurah);
    }
    return [...set].map((s) => ({ value: s, label: s }));
  }, [db.curriculum, student, open]);

  const patch = (q: ExamQuestion, p: Partial<ExamQuestion>) =>
    store.setQuestions(open!.id, questions.map((x) => (x.id === q.id ? { ...x, ...p } : x)));

  /** Add or remove a question and renumber, «ويعيد النظام ترقيم الأسئلة». */
  const renumber = (list: ExamQuestion[]) =>
    store.setQuestions(open!.id, list.map((q, i) => ({ ...q, seq: i + 1 })));

  const approve = () => {
    if (!open || !student) return;
    const exam = store.approveBooking({
      bookingId: open.id,
      exam: {
        studentId: student.id,
        halaqaId: student.halaqaId,
        track: student.track,
        type: open.badge,
        takenOn: open.scheduledOn,
        level: open.level,
        ajza: ajzaForLevel(student.track, open.level),
        errors: totals.errors,
        warnings: totals.warnings,
        tajweedErrors: totals.tajweedErrors,
        score,
        passed,
        pointsAwarded: suggestedPoints,
        pointsPaid: suggestedPoints > 0,
        note: '',
        examiner: '',
        tajweedTopic: null,
        source: 'ONSITE',
        createdAt: new Date().toISOString(),
      },
    });
    setApproving(false);
    if (exam) {
      setToast(`اعتُمد الاختبار — الدرجة ${exam.score}${exam.pointsPaid ? ` ومعه ${exam.pointsAwarded} نقطة` : ''}.`);
      router.replace('/admin/exams/onsite');
    }
  };

  /* ── the sheet view ─────────────────────────────────────────────────────── */
  if (open && student) {
    const done = open.status !== 'BOOKED';
    return (
      <>
        <TopBar title="صفحة الاختبار" crumbs={['الاختبارات', student.fullName]}
          panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
          action={!done ? (
            <Btn variant="primary" size="lg" icon={Check} onClick={() => setApproving(true)}>
              اعتماد النتيجة
            </Btn>
          ) : <Chip tone="ok">أُجري</Chip>} />

        <div className="mx-auto max-w-column px-6 py-8 pb-16">
          <button onClick={() => router.replace('/admin/exams/onsite')}
            className="rise mb-4 inline-flex items-center gap-1 text-panel text-ink-500 transition-colors hover:text-brand-800">
            <ChevronLeft size={15} /> قائمة الحجوزات
          </button>

          {/* ── the running score ───────────────────────────────────────── */}
          <Sheet className="rise mb-4 border-brand-200 bg-brand-50/50">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <h2 className="font-display text-t1 text-ink-900">{student.fullName}</h2>
                <p className="mt-1 text-panel text-ink-600">
                  {EXAM_TYPE_AR[open.badge]} · المستوى <Num>{open.level ?? '—'}</Num>
                  {ajzaForLevel(student.track, open.level) !== null && (
                    <> · <Num>{ajzaForLevel(student.track, open.level)}</Num>{' '}{juzWord(ajzaForLevel(student.track, open.level)!)}</>
                  )} · {halaqaOf(student.id)}
                </p>
              </div>
              <div className="text-center">
                <p className="font-display text-d1 leading-none text-brand-800">
                  <Num>{score}</Num>
                </p>
                <p className="mt-1 text-micro text-ink-500">من ١٠٠ · محسوبة لحظيًّا</p>
              </div>
              <div className="flex gap-4 text-center">
                {([['أخطاء', totals.errors, SCORE_DEDUCTIONS.error],
                   ['تنبيهات', totals.warnings, SCORE_DEDUCTIONS.warning],
                   ['تجويدية', totals.tajweedErrors, SCORE_DEDUCTIONS.tajweedError]] as const).map(
                  ([l, n, each]) => (
                    <div key={l}>
                      <p className="font-display text-t1 text-ink-900"><Num>{n}</Num></p>
                      <p className="text-micro text-ink-500">{l}</p>
                      {n > 0 && <p className="text-micro text-risk-700"><Num>{`− ${n * each}`}</Num></p>}
                    </div>
                  ))}
              </div>
            </div>
          </Sheet>

          {/* ── one row per question ────────────────────────────────────── */}
          <Sheet className="rise" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-body">
                <thead>
                  <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                    {['#', 'الموضع', 'من آية', 'إلى آية', 'أخطاء', 'تنبيهات', 'تجويدية', 'ملاحظة', ''].map((h) => (
                      <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id} className="border-b border-ink-150 last:border-0">
                      <td className="px-3 py-3 font-display text-lg2 text-ink-900"><Num>{q.seq}</Num></td>
                      <td className="min-w-[9rem] px-2 py-2">
                        <Combobox value={q.surah} onChange={(v) => patch(q, { surah: v })}
                          options={surahOptions} creatable createLabel="سورة"
                          placeholder="السورة" emptyText="اكتب اسم السورة"
                          disabled={done} />
                      </td>
                      {(['ayahFrom', 'ayahTo'] as const).map((f) => (
                        <td key={f} className="w-20 px-2 py-2">
                          <input className={cx(INPUT, 'h-9 px-2 text-panel')} inputMode="numeric"
                            value={q[f]} disabled={done}
                            onChange={(e) => patch(q, { [f]: e.target.value.replace(/[^\d]/g, '') })} />
                        </td>
                      ))}
                      {(['errors', 'warnings', 'tajweedErrors'] as const).map((f) => (
                        <td key={f} className="px-2 py-2">
                          {/* Tapped, never typed — his hands are busy listening. */}
                          <div className="flex items-center gap-1">
                            <button disabled={done}
                              onClick={() => { patch(q, { [f]: q[f] + 1 }); setScoreOverride(null); }}
                              aria-label={`زيادة ${f} للسؤال ${q.seq}`}
                              className="flex h-9 w-9 items-center justify-center rounded-md bg-ink-100 text-ink-700 transition-colors hover:bg-brand-100 hover:text-brand-800 active:scale-95 disabled:opacity-40">
                              <Plus size={16} strokeWidth={2.4} />
                            </button>
                            <span className="w-6 text-center font-display text-lg2 text-ink-900">
                              <Num>{q[f]}</Num>
                            </span>
                            <button disabled={done || q[f] === 0}
                              onClick={() => { patch(q, { [f]: Math.max(0, q[f] - 1) }); setScoreOverride(null); }}
                              aria-label={`إنقاص ${f} للسؤال ${q.seq}`}
                              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800 active:scale-95 disabled:opacity-30">
                              <Minus size={16} strokeWidth={2.4} />
                            </button>
                          </div>
                        </td>
                      ))}
                      <td className="min-w-[9rem] px-2 py-2">
                        <input className={cx(INPUT, 'h-9 px-2 text-panel')} value={q.note} disabled={done}
                          onChange={(e) => patch(q, { note: e.target.value })} placeholder="…" />
                      </td>
                      <td className="px-2 py-2 text-end">
                        {!done && questions.length > 1 && (
                          <button onClick={() => renumber(questions.filter((x) => x.id !== q.id))}
                            title="حذف السؤال" aria-label={`حذف السؤال ${q.seq}`}
                            className="rounded p-1.5 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!done && (
              <div className="border-t border-ink-150 p-3">
                <button onClick={() => renumber([...questions, blankQuestion(open.id, questions.length + 1)])}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2.5 text-panel text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800">
                  <Plus size={16} strokeWidth={2.2} /> إضافة سؤال
                </button>
              </div>
            )}
          </Sheet>

          <p className="mt-4 text-panel text-ink-500">
            النظام لا يصحّح التسميع — أنت من يستمع ويحكم. دوره أن يعدّ ويحسب ويحفظ،
            بدل الورقة والقلم والآلة الحاسبة.
          </p>
        </div>

        {/* ── الاعتماد ──────────────────────────────────────────────────── */}
        <Modal open={approving} onClose={() => setApproving(false)} wide title="اعتماد نتيجة الاختبار"
          footer={
            <>
              <Btn onClick={() => setApproving(false)}>تراجع</Btn>
              <Btn variant="primary" icon={Check} onClick={approve}>اعتماد</Btn>
            </>
          }>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الدرجة النهائية"
                hint={scoreOverride === null ? 'محسوبة من العدّادات — اكتب فوقها لتتجاوزها' : 'تجاوزتَ الحساب'}>
                <input className={INPUT} inputMode="decimal"
                  value={scoreOverride ?? String(computed)}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, '');
                    setScoreOverride(Number(v) > 100 ? '100' : v);
                    setPassOverride(null);
                  }} />
              </Field>
              <div>
                <span className="mb-1.5 block text-xs2 font-medium text-ink-600">النتيجة</span>
                <div className="inline-flex rounded-md border border-ink-200 bg-paper p-0.5">
                  {([[true, 'اجتاز'], [false, 'لم يجتز']] as const).map(([v, l]) => (
                    <button key={l} type="button" onClick={() => setPassOverride(v)}
                      className={cx('h-9 rounded px-4 text-body font-medium transition-colors',
                        passed === v
                          ? (v ? 'bg-ok-100 text-ok-700' : 'bg-risk-100 text-risk-700')
                          : 'text-ink-600 hover:bg-ink-100')}>{l}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-page px-3.5 py-3 text-panel text-ink-700">
              {plural(questions.length, 'سؤال', 'سؤالان', 'أسئلة', 'سؤالًا')} ·
              أخطاء <Num>{totals.errors}</Num> · تنبيهات <Num>{totals.warnings}</Num> ·
              تجويدية <Num>{totals.tajweedErrors}</Num>
            </div>

            {suggestedPoints > 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-brand-50 px-3.5 py-3 text-base2 text-ink-800">
                <Coins size={16} className="shrink-0 text-brand-800" />
                تُضاف <Num className="font-medium text-brand-800">{suggestedPoints}</Num>{' '}
                {pointWord(suggestedPoints)} إلى رصيده مع الاعتماد، في الحركة نفسها.
              </p>
            )}
          </div>
        </Modal>

        {toast && (
          <div role="status" className="fade fixed bottom-6 start-1/2 z-[70] -translate-x-1/2 rounded-lg bg-brand-900 px-4 py-2.5 text-body text-white shadow-pop">
            {toast}
          </div>
        )}
      </>
    );
  }

  /* ── the booking list ───────────────────────────────────────────────────── */
  return (
    <>
      <TopBar title="الاختبار على الشاشة" crumbs={['الاختبارات']}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            {todays.length > 0 && (
              <a href="/print/bookings" target="_blank" rel="noreferrer">
                <Btn icon={Printer}>قائمة اليوم</Btn>
              </a>
            )}
            <Btn variant="primary" icon={CalendarPlus} onClick={() => setBooking(true)}>حجز اختبار</Btn>
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        {rows.length === 0 ? (
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا حجوزات بعد"
              body="سجّل من سيُختبر ومتى وفي أي مستوى ولأي وسام، فتظهر قائمة اليوم هنا وتُطبع. ثم تفتح الطالب وتُجري الاختبار على الشاشة بدل الورقة."
              action={<Btn variant="primary" size="lg" icon={CalendarPlus}
                onClick={() => setBooking(true)}>حجز أول اختبار</Btn>} />
          </Sheet>
        ) : (
          <Sheet className="rise" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-body">
                <thead>
                  <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                    {['التاريخ', 'الطالب', 'الحلقة', 'الوسام', 'المستوى', 'الحالة', ''].map((h) => (
                      <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className={cx('border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50',
                      b.scheduledOn === today && b.status === 'BOOKED' && 'bg-brand-50/40')}>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Num className="text-panel text-ink-600">{formatDate(b.scheduledOn)}</Num>
                        {b.scheduledOn === today && <> <Chip tone="brand">اليوم</Chip></>}
                      </td>
                      <td className="px-3 py-3 text-ink-900">{nameOf(b.studentId)}</td>
                      <td className="px-3 py-3 text-panel text-ink-600">{halaqaOf(b.studentId)}</td>
                      <td className="px-3 py-3">
                        <Chip tone={b.badge === 'BADGE_DIAMOND' ? 'brand' : 'warn'}>
                          {EXAM_TYPE_AR[b.badge]}
                        </Chip>
                      </td>
                      <td className="px-3 py-3"><Num className="text-panel text-ink-700">{b.level ?? '—'}</Num></td>
                      <td className="px-3 py-3">
                        <Chip tone={b.status === 'DONE' ? 'ok' : b.status === 'CANCELLED' ? 'risk' : 'warn'}>
                          {BOOKING_STATUS_AR[b.status]}
                        </Chip>
                      </td>
                      <td className="px-3 py-3 text-end">
                        {b.status === 'BOOKED' ? (
                          <div className="flex items-center justify-end gap-1">
                            <Btn size="sm" icon={ClipboardCheck}
                              onClick={() => router.replace(`/admin/exams/onsite?booking=${b.id}`)}>
                              ابدأ الاختبار
                            </Btn>
                            <button onClick={() => store.cancelBooking(b.id)}
                              title="إلغاء الحجز" aria-label={`إلغاء حجز ${nameOf(b.studentId)}`}
                              className="rounded p-1.5 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700">
                              <X size={15} />
                            </button>
                          </div>
                        ) : b.examId ? (
                          <Link href="/admin/exams" className="text-panel text-brand-800 hover:underline">
                            في السجلّ
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sheet>
        )}
      </div>

      {/* ── حجز اختبار ──────────────────────────────────────────────────── */}
      <Modal open={booking} onClose={() => setBooking(false)} wide title="حجز اختبار"
        footer={
          <>
            <Btn onClick={() => setBooking(false)}>إلغاء</Btn>
            <Btn variant="primary" disabled={!bStudent} onClick={() => {
              const s = db.students.find((x) => x.id === bStudent);
              if (!s) return;
              store.book({ studentId: s.id, scheduledOn: bDate, level: s.currentLevel, badge: bBadge, note: '' });
              setBooking(false); setBStudent('');
              setToast('حُجز الاختبار وظهر في القائمة.');
            }}>حجز</Btn>
          </>
        }>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الطالب"
              hint={talqeenCount > 0
                ? `${talqeenCount} من طلاب التلقين خارج القائمة — لا وسام لهم`
                : 'ابحث بالاسم'}>
              <Combobox value={bStudent} onChange={setBStudent}
                options={eligible.map((s) => ({
                  value: s.id, label: s.fullName,
                  hint: s.currentLevel != null ? `المستوى ${s.currentLevel}` : 'بلا مستوى',
                })).sort((a, b) => a.label.localeCompare(b.label, 'ar'))}
                placeholder="اختر الطالب" searchPlaceholder="ابحث بالاسم…" emptyText="لا طالب بهذا الاسم" />
            </Field>
            <Field label="التاريخ">
              <input type="date" className={INPUT} value={bDate}
                onChange={(e) => setBDate(e.target.value)} />
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-xs2 font-medium text-ink-600">الوسام</span>
            <div className="flex gap-2">
              {BADGES.map((b) => (
                <button key={b} type="button" onClick={() => setBBadge(b)}
                  className={cx('rounded-lg border px-3.5 py-2 text-body transition-colors',
                    bBadge === b ? 'border-brand-700 bg-brand-50 font-medium text-brand-800'
                      : 'border-ink-200 text-ink-700 hover:border-ink-300')}>
                  {EXAM_TYPE_AR[b]}
                </button>
              ))}
            </div>
          </div>
          {bStudent && db.students.find((s) => s.id === bStudent)?.currentLevel == null && (
            <p className="flex items-start gap-2.5 rounded-lg bg-warn-100 px-3.5 py-3 text-panel text-warn-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              لا مستوى محفوظ لهذا الطالب، فسيُحجز بلا مستوى — وتستطيع ضبطه قبل الاعتماد.
            </p>
          )}
        </div>
      </Modal>

      {toast && (
        <div role="status" className="fade fixed bottom-6 start-1/2 z-[70] -translate-x-1/2 rounded-lg bg-brand-900 px-4 py-2.5 text-body text-white shadow-pop">
          {toast}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><OnsiteScreen /></Suspense>;
}
