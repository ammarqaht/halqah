'use client';
/* تقرير الطالب الشامل — §١٤: «بياناته ومستوياته وتواريخها واختباراته وحضوره
   وتسميعه ونقاطه — لولي الأمر أو لملفه».

   «وهي نفسها ما يفتحه المعلم حين يسأله ولي الأمر عن ابنه» — so this is the
   student's file, laid out for one page and for a reader who is not a teacher:
   the sections are named, the attendance is a grid he can count, and every
   figure is in Arabic-Indic numerals because it is printed (DESIGN §2.2).

   No behavioural note, no medical line, no guardian number — §١٧ forbids all
   three, and none of them exist in the database to print. */
import { useParams } from 'next/navigation';
import { AlertTriangle, Printer } from 'lucide-react';
import { Btn, Empty } from '@/components/ui';
import { Num, toArabicDigits } from '@/components/Num';
import { PrintHead, PrintFoot, PrintSec, PCELL, PCELL_TIGHT } from '@/components/PrintHead';
import { useFetch } from '@/components/teacher/PrintSheet';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Payload = {
  student: {
    id: string; fullName: string; trackAr: string | null;
    grade: string | null; stage: string | null;
    level: number | null; ajza: number | null;
    assignmentNo: number | null; assignmentOf: number;
    balance: number | null; eligibleForPoints: boolean;
    planIssuedAt: string | null; planDaysHeld: number | null; lateOnLevel: boolean;
    ratelAttendedDays: number | null;
  };
  grid: { day: string; status: string; thobe: boolean; incomplete: boolean }[];
  absence: { streak: number; inWindow: number; flagged: boolean; days: string[] };
  recitation: {
    day: string; assignmentNo: number | null; incomplete: boolean; note: string;
    lines: { kind: string; kindAr: string; recited: boolean; errors: number }[];
  }[];
  levels: { level: number; issuedAt: string; daysHeld: number | null }[];
  exams: {
    id: string; typeAr: string; takenOn: string; level: number | null;
    errors: number | null; tajweedErrors: number | null;
    score: number | null; passed: boolean | null; examiner: string;
  }[];
  errorSpots: { surah: string; errors: number }[];
};

const STATUS_MARK: Record<string, { mark: string; cls: string }> = {
  PRESENT: { mark: '●', cls: 'bg-ok-100 text-ok-700' },
  LATE:    { mark: '◐', cls: 'bg-warn-100 text-warn-700' },
  ABSENT:  { mark: '✕', cls: 'bg-risk-100 text-risk-700' },
};

export default function StudentReport() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useFetch<Payload>(`/api/teacher/students/${id}`);
  const s = data?.student;

  const counted = (st: string) => (data?.grid ?? []).filter((g) => g.status === st).length;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead title="تقرير الطالب"
          sub={s ? (
            <>
              {s.fullName}
              {s.trackAr && <> — المسار {s.trackAr}</>}
              {s.level != null && <> · المستوى <Num>{toArabicDigits(s.level)}</Num></>}
            </>
          ) : undefined} />

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel h-7 rounded" />)}
          </div>
        ) : error || !data || !s ? (
          <Empty icon={AlertTriangle} title="تعذّر تحميل التقرير"
            body={error || 'لم يُعثر على الطالب.'} />
        ) : (
          <>
            {/* ── بياناته ────────────────────────────────────────────────── */}
            <PrintSec>بياناته</PrintSec>
            <table className="w-full border-collapse text-cap">
              <tbody>
                <tr>
                  <th className={cx(PCELL, 'bg-brand-50')}>المرحلة</th>
                  <td className={PCELL_TIGHT}>{s.stage || '—'}</td>
                  <th className={cx(PCELL, 'bg-brand-50')}>الصف</th>
                  <td className={PCELL_TIGHT}>{s.grade || '—'}</td>
                  <th className={cx(PCELL, 'bg-brand-50')}>الأجزاء</th>
                  <td className={PCELL_TIGHT}>
                    {s.ajza != null ? <Num>{toArabicDigits(s.ajza)}</Num> : '—'}
                  </td>
                </tr>
                <tr>
                  <th className={cx(PCELL, 'bg-brand-50')}>المقرّر الحالي</th>
                  <td className={PCELL_TIGHT}>
                    {s.assignmentNo != null
                      ? <>
                          <Num>{toArabicDigits(s.assignmentNo)}</Num>
                          {s.assignmentOf > 0 && <> من <Num>{toArabicDigits(s.assignmentOf)}</Num></>}
                        </>
                      : '—'}
                  </td>
                  <th className={cx(PCELL, 'bg-brand-50')}>تسليم خطته</th>
                  <td className={PCELL_TIGHT}>
                    {s.planIssuedAt ? <Num>{toArabicDigits(formatDate(s.planIssuedAt))}</Num> : '—'}
                    {s.planDaysHeld != null && (
                      <> (<Num>{toArabicDigits(s.planDaysHeld)}</Num> يومًا)</>
                    )}
                  </td>
                  <th className={cx(PCELL, 'bg-brand-50')}>رصيد النقاط</th>
                  <td className={PCELL_TIGHT}>
                    {s.balance != null ? <Num>{toArabicDigits(s.balance)}</Num> : '—'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── حضوره ─────────────────────────────────────────────────── */}
            <PrintSec>حضوره</PrintSec>
            <p className="mb-1.5 flex flex-wrap gap-x-3 text-cap text-ink-700">
              <span>حاضر: <Num className="font-bold">{toArabicDigits(counted('PRESENT'))}</Num></span>
              <span>متأخر: <Num className="font-bold">{toArabicDigits(counted('LATE'))}</Num></span>
              <span>غائب: <Num className="font-bold">{toArabicDigits(counted('ABSENT'))}</Num></span>
              <span className="text-ink-500">
                (من <Num>{toArabicDigits(data.grid.length)}</Num> يوم حلقة مسجَّل)
              </span>
            </p>

            {data.grid.length === 0 ? (
              <p className="text-cap text-ink-500">لم يُسجَّل له يوم بعد.</p>
            ) : (
              <div dir="ltr" className="flex flex-wrap gap-0.5">
                {[...data.grid].reverse().map((g) => {
                  const m = STATUS_MARK[g.status] ?? { mark: '·', cls: '' };
                  return (
                    <span key={g.day} title={g.day}
                      className={cx('grid h-5 w-5 place-items-center rounded-sm border border-ink-200 text-[8px] leading-none', m.cls)}>
                      {m.mark}
                    </span>
                  );
                })}
              </div>
            )}

            {data.absence.flagged && (
              <p className="mt-1.5 text-cap text-risk-700">
                غياب متكرر: <Num>{toArabicDigits(data.absence.streak)}</Num> أيام حلقة
                متتالية، و<Num>{toArabicDigits(data.absence.inWindow)}</Num> في آخر
                ثلاثين يومًا.
              </p>
            )}

            {s.ratelAttendedDays != null && (
              <p className="mt-1 text-[9.5px] text-ink-500">
                وما سبق البوابة:{' '}
                <Num>{toArabicDigits(s.ratelAttendedDays)}</Num> يومًا مجملًا بلا تواريخ —
                لا يُجمع مع الشبكة أعلاه.
              </p>
            )}

            {/* ── مستوياته ──────────────────────────────────────────────── */}
            {data.levels.length > 0 && (
              <>
                <PrintSec>مساره بين المستويات</PrintSec>
                <table className="w-full border-collapse text-cap">
                  <thead>
                    <tr className="bg-brand-50">
                      <th className={PCELL}>المستوى</th>
                      <th className={PCELL}>تاريخ التسليم</th>
                      <th className={PCELL}>المدة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.levels.map((l) => (
                      <tr key={`${l.level}-${l.issuedAt}`}>
                        <td className={PCELL_TIGHT}><Num>{toArabicDigits(l.level)}</Num></td>
                        <td className={PCELL_TIGHT}>
                          <Num>{toArabicDigits(formatDate(l.issuedAt))}</Num>
                        </td>
                        <td className={PCELL_TIGHT}>
                          {l.daysHeld != null
                            ? <><Num>{toArabicDigits(l.daysHeld)}</Num> يومًا</> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* ── اختباراته ─────────────────────────────────────────────── */}
            <PrintSec>اختباراته</PrintSec>
            {data.exams.length === 0 ? (
              <p className="text-cap text-ink-500">لم تُسجَّل له اختبارات بعد.</p>
            ) : (
              <table className="w-full border-collapse text-cap">
                <thead>
                  <tr className="bg-brand-50">
                    <th className={PCELL}>الاختبار</th>
                    <th className={PCELL}>التاريخ</th>
                    <th className={PCELL}>المستوى</th>
                    <th className={PCELL}>أخطاء</th>
                    <th className={PCELL}>تجويد</th>
                    <th className={PCELL}>الدرجة</th>
                    <th className={PCELL}>النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.exams.slice(0, 14).map((e) => (
                    <tr key={e.id}>
                      <td className={PCELL_TIGHT}>{e.typeAr}</td>
                      <td className={PCELL_TIGHT}>
                        <Num>{toArabicDigits(formatDate(e.takenOn))}</Num>
                      </td>
                      <td className={PCELL_TIGHT}>
                        {e.level != null ? <Num>{toArabicDigits(e.level)}</Num> : '—'}
                      </td>
                      <td className={PCELL_TIGHT}>
                        {e.errors != null ? <Num>{toArabicDigits(e.errors)}</Num> : '—'}
                      </td>
                      <td className={PCELL_TIGHT}>
                        {e.tajweedErrors != null
                          ? <Num>{toArabicDigits(e.tajweedErrors)}</Num> : '—'}
                      </td>
                      <td className={cx(PCELL_TIGHT, 'font-bold')}>
                        {e.score != null ? <Num>{toArabicDigits(e.score)}</Num> : '—'}
                      </td>
                      <td className={PCELL_TIGHT}>
                        {e.passed === true ? '● اجتاز'
                          : e.passed === false ? '✕ لم يجتز' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* ── تسميعه ────────────────────────────────────────────────── */}
            <PrintSec>آخر ما سمّعه</PrintSec>
            {data.recitation.length === 0 ? (
              <p className="text-cap text-ink-500">لم يُسجَّل تسميع بعد.</p>
            ) : (
              <table className="w-full border-collapse text-cap">
                <thead>
                  <tr className="bg-brand-50">
                    <th className={PCELL}>التاريخ</th>
                    <th className={PCELL}>المقرّر</th>
                    <th className={PCELL}>م.ك</th>
                    <th className={PCELL}>م.ص</th>
                    <th className={PCELL}>درس</th>
                    <th className={PCELL}>أخطاء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recitation.slice(0, 12).map((r) => {
                    const of = (k: string) => r.lines.find((l) => l.kind === k);
                    const mark = (k: string) => {
                      const l = of(k);
                      return l?.recited ? '●' : '—';
                    };
                    const errors = r.lines.reduce((n, l) => n + l.errors, 0);
                    return (
                      <tr key={r.day} className={cx(r.incomplete && 'bg-warn-100')}>
                        <td className={PCELL_TIGHT}>
                          <Num>{toArabicDigits(formatDate(r.day))}</Num>
                        </td>
                        <td className={PCELL_TIGHT}>
                          {r.assignmentNo != null
                            ? <Num>{toArabicDigits(r.assignmentNo)}</Num> : '—'}
                          {r.incomplete && <span className="ms-1 text-[9px]">(ناقص)</span>}
                        </td>
                        <td className={PCELL_TIGHT}>{mark('MURAJAA_KUBRA')}</td>
                        <td className={PCELL_TIGHT}>{mark('MURAJAA_SUGHRA')}</td>
                        <td className={PCELL_TIGHT}>{mark('DARS')}</td>
                        <td className={PCELL_TIGHT}>
                          {errors > 0 ? <Num>{toArabicDigits(errors)}</Num> : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {data.errorSpots.length > 0 && (
              <p className="mt-2 text-cap leading-relaxed text-ink-700">
                <span className="font-bold">مواضع تكرار الخطأ:</span>{' '}
                {data.errorSpots.slice(0, 6).map((e, i) => (
                  <span key={e.surah}>
                    {i > 0 && ' · '}
                    {e.surah} (<Num>{toArabicDigits(e.errors)}</Num>)
                  </span>
                ))}
              </p>
            )}
          </>
        )}

        <PrintFoot>● حاضر · ◐ متأخر · ✕ غائب</PrintFoot>
      </div>
    </>
  );
}
