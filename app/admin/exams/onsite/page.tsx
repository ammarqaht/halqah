'use client';
/* حجوزات الاختبارات — SPEC.md §6.9, approved PDF §9 (إد-٥-ج).
   «تُسجّل من سيُختبر ومتى وفي أي مستوى ولأي وسام».

   The appointment book, and only that. The sitting itself is recorded on
   «تسجيل اختبار»: this screen used to carry a second scoring sheet of its own,
   and two forms for one act drifted apart — different fields, different
   arithmetic, two places to fix a rule. «ابدأ الاختبار» now opens the one
   recording form with the booking already filled in, and the booking closes
   itself when that form saves.

   FOUR HUNDRED APPOINTMENTS ARE A LEDGER, NOT A LIST. «أبي خيارات تصفية بالوسام
   أو الوقت (أُجري — اليوم — محجوز — أُلغي)» (client, 18 Sep 2026): the book is
   read with a question in mind — who is sitting today, what is still open, what
   was already done — and one column of every booking ever made answers none of
   them. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ClipboardCheck, X, CalendarPlus, Printer, AlertTriangle, Inbox, Pencil,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty, Chip, Modal, Field, INPUT_BARE } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { DateField } from '@/components/DateField';
import { Num, juzPhrase } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { earnsPoints, EXAM_TYPE_AR } from '@/lib/points';
import { readyForAssociation } from '@/lib/exams';
import { BOOKING_STATUS_AR, type BookingBadge, type ExamBooking } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { isoDate, formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

const BADGES: BookingBadge[] = ['BADGE_GOLDEN', 'BADGE_DIAMOND', 'ASSOCIATION'];

/* «بالوقت (أُجري — اليوم — محجوز — أُلغي)» — the client's own four, in his own
   order. `today` is a CUT of `booked` rather than a status of its own: a
   booking is not in a fifth state because its day happens to be this one.

   The CHOOSING happens in the side panel — «خيارات التصفية تكون في البار
   الجانبي وليس فوق» (client, 18 Sep 2026) — and arrives here as `?when=` and
   `?badge=`, which also makes a cut of the book a link. */
type When = 'all' | 'done' | 'today' | 'booked' | 'cancelled';

const BADGE_TONE = (b: string) =>
  b === 'BADGE_DIAMOND' ? 'brand' : b === 'ASSOCIATION' ? 'assoc' : 'warn';

function OnsiteScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const router = useRouter();

  /** `null` while closed; `{editing: null}` for a new booking. */
  const [form, setForm] = useState<{ editing: ExamBooking | null } | null>(null);
  const [bStudent, setBStudent] = useState('');
  const [bDate, setBDate] = useState(isoDate(new Date()));
  const [bBadge, setBBadge] = useState<BookingBadge>('BADGE_GOLDEN');
  const [bNote, setBNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const sp = useSearchParams();
  const when = (sp.get('when') ?? 'all') as When;
  const badge = (sp.get('badge') ?? 'all') as BookingBadge | 'all';

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const eligible = useMemo(() => db.students.filter(earnsPoints), [db.students]);
  const talqeenCount = db.students.length - eligible.length;

  const nameOf = (id: string) => db.students.find((s) => s.id === id)?.fullName ?? '—';
  /** «يحتاج مراجعة» — رأي معلّمه، يصل مع الكشف ولا يُكتب من هنا. */
  const holdOf = (id: string) => db.students.find((s) => s.id === id)?.examHold ?? null;
  const halaqaOf = (id: string) => {
    const s = db.students.find((x) => x.id === id);
    const t = s?.halaqaId ? db.halaqat.find((h) => h.id === s.halaqaId)?.teacher : null;
    return t ? shortName(t) : '—';
  };

  /* ── الجاهزية لاختبار الجمعية — §4.8 ──────────────────────────────────────
     «متى يُحجز اختبار جمعية للطالب؟ بعد الوسام الماسي للمستويات الذهبية جميعها،
     أو بعد الوسام الماسي للمستويات الفردية للمسار الفضي» (client, 18 Sep 2026)
     — which is §4.8 itself, said from the other end: the diamond is the proof
     that a JUZ was completed, and only a golden level or an ODD silver one
     completes one. So nothing new is judged here; the rule that already names
     the ready students is the rule that opens this choice. */
  const readiness = useMemo(() => {
    const s = db.students.find((x) => x.id === bStudent);
    if (!s) return null;
    return readyForAssociation({
      track: s.track, level: s.currentLevel,
      exams: db.exams.filter((e) => e.studentId === s.id),
    });
  }, [bStudent, db.students, db.exams]);

  /* A badge chosen for one boy must not silently stay chosen for the next: the
     association is the only one of the three that is not always available. */
  useEffect(() => {
    if (bBadge === 'ASSOCIATION' && readiness && !readiness.ready) setBBadge('BADGE_DIAMOND');
  }, [bBadge, readiness]);

  /* ── the book ───────────────────────────────────────────────────────────── */
  const today = isoDate(new Date());
  const all = useMemo(() => [...db.bookings]
    .sort((a, b) => (a.scheduledOn === b.scheduledOn
      ? (a.createdAt < b.createdAt ? -1 : 1)
      : (a.scheduledOn < b.scheduledOn ? 1 : -1))), [db.bookings]);

  const rows = useMemo(() => all.filter((b) => {
    if (badge !== 'all' && b.badge !== badge) return false;
    if (when === 'done') return b.status === 'DONE';
    if (when === 'cancelled') return b.status === 'CANCELLED';
    if (when === 'booked') return b.status === 'BOOKED';
    if (when === 'today') return b.status === 'BOOKED' && b.scheduledOn === today;
    return true;
  }), [all, when, badge, today]);

  const todays = all.filter((b) => b.scheduledOn === today && b.status === 'BOOKED');

  const openNew = () => {
    setBStudent(''); setBDate(today); setBBadge('BADGE_GOLDEN'); setBNote('');
    setForm({ editing: null });
  };
  const openEdit = (b: ExamBooking) => {
    setBStudent(b.studentId); setBDate(b.scheduledOn); setBBadge(b.badge); setBNote(b.note);
    setForm({ editing: b });
  };

  const submit = () => {
    const s = db.students.find((x) => x.id === bStudent);
    if (!s || !form) return;
    if (form.editing) {
      store.editBooking(form.editing.id, {
        studentId: s.id, scheduledOn: bDate, badge: bBadge, note: bNote,
        /* The level follows the student: a booking moved onto another boy must
           not carry the first one's level with it. */
        level: s.id === form.editing.studentId ? form.editing.level : s.currentLevel,
      });
      setToast('عُدّل الحجز.');
    } else {
      store.book({ studentId: s.id, scheduledOn: bDate, level: s.currentLevel,
        badge: bBadge, note: bNote });
      setToast('حُجز الاختبار وظهر في القائمة.');
    }
    setForm(null); setBStudent('');
  };

  return (
    <>
      <TopBar title="حجوزات الاختبارات" crumbs={['الاختبارات']}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            {todays.length > 0 && (
              <a href="/print/bookings" target="_blank" rel="noreferrer">
                <Btn icon={Printer}>قائمة اليوم</Btn>
              </a>
            )}
            <Btn variant="primary" icon={CalendarPlus} onClick={openNew}>حجز اختبار</Btn>
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        {all.length === 0 ? (
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا حجوزات بعد"
              body="سجّل من سيُختبر ومتى وفي أي مستوى ولأي وسام، فتظهر قائمة اليوم هنا وتُطبع. ثم «ابدأ الاختبار» يفتح نموذج التسجيل معبَّأً من الحجز."
              action={<Btn variant="primary" size="lg" icon={CalendarPlus}
                onClick={openNew}>حجز أول اختبار</Btn>} />
          </Sheet>
        ) : (
          <>
            {/* التصفية في البار الجانبي — لا فوق الجدول. وحين تُختار، يقول
                الرأسُ أيّ قطعة من الدفتر هذه، فلا يبدو الجدولُ ناقصًا بلا سبب. */}
            {(when !== 'all' || badge !== 'all') && (
              <p className="rise mb-3 flex flex-wrap items-center gap-2 text-panel text-ink-600">
                <span className="text-ink-500">المعروض:</span>
                {when !== 'all' && (
                  <span className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-brand-800">
                    {when === 'done' ? 'أُجري' : when === 'today' ? 'اليوم'
                      : when === 'booked' ? 'محجوز' : 'أُلغي'}
                  </span>
                )}
                {badge !== 'all' && (
                  <span className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-brand-800">
                    {EXAM_TYPE_AR[badge]}
                  </span>
                )}
                <span className="text-ink-500">
                  · <Num className="font-medium text-ink-900">{rows.length}</Num> من{' '}
                  <Num>{all.length}</Num>
                </span>
              </p>
            )}

            <Sheet className="rise" pad={false}>
              {rows.length === 0 ? (
                <Empty icon={Inbox} title="لا حجوزات في هذه التصفية"
                  body="جرّب وقتًا آخر أو وسامًا آخر." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[46rem] border-collapse text-body">
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
                          <td className="px-3 py-3 text-ink-900">
                            {nameOf(b.studentId)}
                            {holdOf(b.studentId) && (
                              <span className="ms-1.5 align-middle">
                                <Chip tone="risk">يحتاج مراجعة</Chip>
                              </span>
                            )}
                            {b.note && (
                              <span className="mt-0.5 block max-w-[14rem] truncate text-micro text-ink-500"
                                title={b.note}>{b.note}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-panel text-ink-600">{halaqaOf(b.studentId)}</td>
                          <td className="px-3 py-3">
                            <Chip tone={BADGE_TONE(b.badge)}>{EXAM_TYPE_AR[b.badge]}</Chip>
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
                                  onClick={() => router.push(`/admin/exams/new?booking=${b.id}`)}>
                                  ابدأ الاختبار
                                </Btn>
                                {/* «أبي إمكانية تعديل تفاصيل حجز اختبار — تضيف
                                    أيقونة قلم بجانب أيقونة الحذف» (client,
                                    18 Sep 2026). Moving a date used to mean
                                    cancelling and re-booking, which leaves the
                                    book carrying an «أُلغي» row that describes
                                    nothing that ever happened. */}
                                <button onClick={() => openEdit(b)}
                                  title="تعديل الحجز" aria-label={`تعديل حجز ${nameOf(b.studentId)}`}
                                  className="rounded p-1.5 text-ink-400 transition-colors hover:bg-brand-100 hover:text-brand-800">
                                  <Pencil size={15} />
                                </button>
                                <button onClick={() => store.cancelBooking(b.id)}
                                  title="إلغاء الحجز" aria-label={`إلغاء حجز ${nameOf(b.studentId)}`}
                                  className="rounded p-1.5 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700">
                                  <X size={15} />
                                </button>
                              </div>
                            ) : b.examId ? (
                              /* Straight to the sitting itself — «وزر في السجل
                                 ينقلني لصفحة الاختبار التي ضغطت عليها مباشرة»
                                 (client, 18 Sep 2026). The log opens with that
                                 exam's own record already showing. */
                              <Link href={`/admin/exams?exam=${b.examId}`}
                                className="text-panel text-brand-800 hover:underline">
                                في السجلّ
                              </Link>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Sheet>
          </>
        )}
      </div>

      {/* ── حجز اختبار، أو تعديله ─────────────────────────────────────────── */}
      <Modal open={form !== null} onClose={() => setForm(null)} wide
        title={form?.editing ? 'تعديل الحجز' : 'حجز اختبار'}
        footer={
          <>
            <Btn onClick={() => setForm(null)}>إلغاء</Btn>
            <Btn variant="primary" disabled={!bStudent} onClick={submit}>
              {form?.editing ? 'حفظ التعديل' : 'حجز'}
            </Btn>
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
              <DateField value={bDate} onChange={setBDate} label="تاريخ الاختبار" chrome="field" />
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-xs2 font-medium text-ink-600">الوسام</span>
            <div className="flex flex-wrap gap-2">
              {BADGES.map((b) => {
                /* الجمعية is offered only to a boy §4.8 says is ready for it.
                   Disabled rather than hidden: a supervisor who came to book it
                   is owed the reason it is not on offer. */
                const blocked = b === 'ASSOCIATION' && !!bStudent && !readiness?.ready;
                return (
                  <button key={b} type="button" disabled={blocked}
                    onClick={() => setBBadge(b)}
                    title={blocked ? (readiness?.reason ?? undefined) : undefined}
                    className={cx('rounded-lg border px-3.5 py-2 text-body transition-colors',
                      bBadge === b ? 'border-brand-700 bg-brand-50 font-medium text-brand-800'
                        : 'border-ink-200 text-ink-700 hover:border-ink-300',
                      blocked && 'cursor-not-allowed opacity-45 hover:border-ink-200')}>
                    {EXAM_TYPE_AR[b]}
                  </button>
                );
              })}
            </div>

            {bStudent && readiness && (
              <p className={cx('mt-2 text-panel',
                readiness.ready ? 'text-ok-700' : 'text-ink-500')}>
                {readiness.ready
                  ? <>جاهز لاختبار الجمعية — اجتاز الوسام الماسي على{' '}
                      <span className="font-medium">{juzPhrase(readiness.ajza ?? 0)}</span>
                      {' '}لم تختبره الجمعية بعد.</>
                  : <>اختبار الجمعية غير متاح: {readiness.reason}.</>}
              </p>
            )}
          </div>

          <Field label="ملاحظة" hint="اختيارية — تظهر مع اسمه في القائمة">
            <input value={bNote} onChange={(e) => setBNote(e.target.value)}
              placeholder="يُختبر بعد العصر…"
              className={cx(INPUT_BARE, 'h-11 w-full')} />
          </Field>

          {/* رأي معلّمه، قبل أن يُحجز الموعد — لا يمنع الحجز، ويُقال في وقته. */}
          {bStudent && holdOf(bStudent) && (
            <p className="flex items-start gap-2.5 rounded-lg border border-warn-200 bg-warn-100 px-3.5 py-3 text-panel text-warn-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                معلّمه يرى أنه يحتاج مراجعة قبل الاختبار
                {holdOf(bStudent)!.note ? ` — ${holdOf(bStudent)!.note}` : ''}
                <span className="text-ink-500"> · {holdOf(bStudent)!.by}</span>
              </span>
            </p>
          )}

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
