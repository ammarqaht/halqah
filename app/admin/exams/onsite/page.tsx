'use client';
/* حجوزات الاختبارات — SPEC.md §6.9, approved PDF §9 (إد-٥-ج).
   «تُسجّل من سيُختبر ومتى وفي أي مستوى ولأي وسام».

   The appointment book, and only that. The sitting itself is recorded on
   «تسجيل اختبار»: this screen used to carry a second scoring sheet of its own,
   and two forms for one act drifted apart — different fields, different
   arithmetic, two places to fix a rule. «ابدأ الاختبار» now opens the one
   recording form with the booking already filled in, and the booking closes
   itself when that form saves. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ClipboardCheck, Plus, X, CalendarPlus, Printer, AlertTriangle, Inbox,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Modal, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { earnsPoints, EXAM_TYPE_AR } from '@/lib/points';
import { BOOKING_STATUS_AR } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { isoDate, formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

const BADGES = ['BADGE_GOLDEN', 'BADGE_DIAMOND'] as const;

function OnsiteScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();

  const [booking, setBooking] = useState(false);
  const [bStudent, setBStudent] = useState('');
  const [bDate, setBDate] = useState(isoDate(new Date()));
  const [bBadge, setBBadge] = useState<typeof BADGES[number]>('BADGE_GOLDEN');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

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

  /* ── the booking list ───────────────────────────────────────────────────── */
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
            <Btn variant="primary" icon={CalendarPlus} onClick={() => setBooking(true)}>حجز اختبار</Btn>
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        {rows.length === 0 ? (
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا حجوزات بعد"
              body="سجّل من سيُختبر ومتى وفي أي مستوى ولأي وسام، فتظهر قائمة اليوم هنا وتُطبع. ثم «ابدأ الاختبار» يفتح نموذج التسجيل معبَّأً من الحجز."
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
                              onClick={() => router.push(`/admin/exams/new?booking=${b.id}`)}>
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
