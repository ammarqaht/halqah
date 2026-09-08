'use client';
/* بيانات فترة — what actually happened between two dates.
   `?from=YYYY-MM-DD&to=YYYY-MM-DD`, either bound optional.

   Distinct from إحصاءات الجمعية, which counts the roster AS IT STANDS and only
   narrows its exam tally to the window. This sheet is the window itself: every
   exam sat, every sheet issued, every point moved. The roster is not sliced,
   because the store keeps no history of who was enrolled when — and a figure
   that cannot be honest about its own period should not be printed beside ones
   that can. */
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { PrintHead, PrintFoot, PrintSec, PCELL } from '@/components/PrintHead';
import { Num, toArabicDigits, pointWord } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { halaqaLabel, shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

const EXAM_ORDER: ExamType[] = ['BADGE_GOLDEN', 'BADGE_DIAMOND', 'ASSOCIATION', 'TAJWEED', 'MOCK'];

function PeriodSheet() {
  const db = useDB();
  const sp = useSearchParams();
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';

  /* An ISO date compares correctly as a string, and both bounds are inclusive
     — «من ١/٩ إلى ٣٠/٩» must contain the thirtieth. */
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);

  const exams = useMemo(
    () => db.exams.filter((e) => inRange(e.takenOn))
      .sort((a, b) => (a.takenOn < b.takenOn ? 1 : -1)),
    [db.exams, from, to]);

  const plans = useMemo(
    () => db.plans.filter((p) => p.printedCount > 0 && inRange(p.issuedAt.slice(0, 10))),
    [db.plans, from, to]);

  const txns = useMemo(
    () => db.txns.filter((t) => inRange(t.createdAt.slice(0, 10))), [db.txns, from, to]);

  const nameOf = (id: string) => db.students.find((s) => s.id === id)?.fullName ?? '—';
  const teacherOf = (id: string | null) => {
    const h = id ? db.halaqat.find((x) => x.id === id) : null;
    return h ? halaqaLabel(shortName(h.teacher)) : '—';
  };

  const byType = useMemo(() => {
    const m = new Map<string, { total: number; passed: number }>();
    for (const e of exams) {
      const r = m.get(e.type) ?? { total: 0, passed: 0 };
      r.total++; if (e.passed === true) r.passed++;
      m.set(e.type, r);
    }
    return m;
  }, [exams]);

  const granted = txns.filter((t) => t.delta > 0).reduce((n, t) => n + t.delta, 0);
  const spent = txns.filter((t) => t.delta < 0).reduce((n, t) => n - t.delta, 0);

  /* Which halaqat were actually busy in the window. */
  const byHalaqa = useMemo(() => {
    const m = new Map<string, { exams: number; passed: number; plans: number }>();
    for (const e of exams) {
      const k = e.halaqaId ?? '—';
      const r = m.get(k) ?? { exams: 0, passed: 0, plans: 0 };
      r.exams++; if (e.passed === true) r.passed++;
      m.set(k, r);
    }
    for (const p of plans) {
      const st = db.students.find((s) => s.id === p.studentId);
      const k = st?.halaqaId ?? '—';
      const r = m.get(k) ?? { exams: 0, passed: 0, plans: 0 };
      r.plans++; m.set(k, r);
    }
    return [...m.entries()].sort((a, b) => b[1].exams - a[1].exams);
  }, [exams, plans, db.students]);

  const span = from && to ? `من ${formatDate(from)} إلى ${formatDate(to)}`
    : from ? `منذ ${formatDate(from)}`
    : to ? `حتى ${formatDate(to)}`
    : 'المدة كاملة — لم تُحدَّد فترة';

  const nothing = exams.length === 0 && plans.length === 0 && txns.length === 0;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead title="بيانات الفترة" sub={<span>{toArabicDigits(span)}</span>} />

        {nothing ? (
          <p className="mt-8 text-center text-base2 text-ink-500">
            لا يوجد نشاط مسجَّل في هذه الفترة.
          </p>
        ) : (
          <>
            <div className="keep mb-4 grid grid-cols-4 gap-3">
              {([
                ['اختبارات', exams.length],
                ['اجتازوا', exams.filter((e) => e.passed === true).length],
                ['خطط سُلِّمت', plans.length],
                ['حركات نقاط', txns.length],
              ] as const).map(([label, v]) => (
                <div key={label} className="rounded-lg border border-ink-200 px-3 py-2.5 text-center">
                  <p className="text-[10px] text-ink-500">{label}</p>
                  <p className="font-display text-h3 text-ink-900"><Num>{toArabicDigits(v)}</Num></p>
                </div>
              ))}
            </div>

            <PrintSec>حصيلة الاختبارات في الفترة</PrintSec>
            <table className="keep w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-page/60 text-[10px] text-ink-700">
                  <th className={PCELL}>النوع</th>
                  {EXAM_ORDER.map((t) => <th key={t} className={PCELL}>{EXAM_TYPE_AR[t]}</th>)}
                </tr>
              </thead>
              <tbody>
                {(['total', 'passed'] as const).map((k) => (
                  <tr key={k}>
                    <th className={`${PCELL} bg-page/60 font-medium`}>{k === 'total' ? 'أُجري' : 'اجتازوا'}</th>
                    {EXAM_ORDER.map((t) => (
                      <td key={t} className={PCELL}>
                        <Num>{toArabicDigits(byType.get(t)?.[k] ?? 0)}</Num>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <PrintSec>النقاط في الفترة</PrintSec>
            <table className="keep w-full border-collapse text-[11px]">
              <tbody>
                <tr>
                  <th className={`${PCELL} bg-page/60 font-medium`}>مُنحت</th>
                  <td className={PCELL}><Num>{toArabicDigits(granted)}</Num> {pointWord(granted)}</td>
                  <th className={`${PCELL} bg-page/60 font-medium`}>صُرفت</th>
                  <td className={PCELL}><Num>{toArabicDigits(spent)}</Num> {pointWord(spent)}</td>
                  <th className={`${PCELL} bg-page/60 font-medium`}>الصافي</th>
                  <td className={PCELL}><Num>{toArabicDigits(granted - spent)}</Num></td>
                </tr>
              </tbody>
            </table>

            {byHalaqa.length > 0 && (
              <>
                <PrintSec>الحلقات في الفترة</PrintSec>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-page/60 text-[10px] text-ink-700">
                      {['الحلقة', 'اختبارات', 'اجتازوا', 'خطط سُلِّمت'].map((h) => (
                        <th key={h} className={PCELL}>{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {byHalaqa.map(([id, r]) => (
                      <tr key={id} className="keep">
                        <td className={`${PCELL} text-start`}>{teacherOf(id === '—' ? null : id)}</td>
                        <td className={PCELL}><Num>{toArabicDigits(r.exams)}</Num></td>
                        <td className={PCELL}><Num>{toArabicDigits(r.passed)}</Num></td>
                        <td className={PCELL}><Num>{toArabicDigits(r.plans)}</Num></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {exams.length > 0 && (
              <>
                <PrintSec>الاختبارات، واحدًا واحدًا</PrintSec>
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-page/60 text-[9.5px] text-ink-700">
                      {['التاريخ', 'الطالب', 'الحلقة', 'النوع', 'المستوى', 'الدرجة', 'النتيجة'].map((h) => (
                        <th key={h} className={PCELL}>{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((e) => (
                      <tr key={e.id} className="keep">
                        <td className={PCELL}><Num>{toArabicDigits(formatDate(e.takenOn))}</Num></td>
                        <td className={`${PCELL} text-start`}>{nameOf(e.studentId)}</td>
                        <td className={`${PCELL} text-start`}>{teacherOf(e.halaqaId)}</td>
                        <td className={PCELL}>{EXAM_TYPE_AR[e.type as ExamType] ?? e.type}</td>
                        <td className={PCELL}>{e.level === null ? '—' : <Num>{toArabicDigits(e.level)}</Num>}</td>
                        <td className={PCELL}>{e.score === null ? '—' : <Num>{toArabicDigits(e.score)}</Num>}</td>
                        <td className={PCELL}>
                          {e.passed === null ? '—' : e.passed ? 'اجتاز' : 'لم يجتز'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        <PrintFoot>
          الأرقام محسوبة من تواريخ الاختبارات والتسليم والحركات — لا من قائمة الطلاب،
          فهي تصف ما حدث في الفترة لا من كان مقيَّدًا فيها.
        </PrintFoot>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><PeriodSheet /></Suspense>; }
