'use client';
/* إحصاءات الجمعية — SPEC.md §6.11 (إد-٥-هـ), layout approved 1 Sep 2026.
   What the association asks the mosque for: headcounts, tracks, stages,
   nationalities, and the exam tally. Carries the association's reserved blue
   (DESIGN.md §1.3) because this sheet leaves the mosque.

   Two versions, per the client's decision: cumulative by default, and a
   **period version** via `?from=YYYY-MM-DD&to=YYYY-MM-DD`. The period bounds
   the exam tally (exams carry dates); the roster figures are the roster as it
   stands today — the store keeps no historical roster to slice.

   Talqeen students are counted everywhere here — §4.11 includes them in all
   association statistics. */
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { PrintHead, PrintFoot, PrintSec, PCELL } from '@/components/PrintHead';
import { Num, toArabicDigits } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { derive } from '@/lib/derive';
import { followUpRows } from '@/lib/followup';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

const EXAM_ORDER: ExamType[] = ['BADGE_GOLDEN', 'BADGE_DIAMOND', 'ASSOCIATION', 'TAJWEED', 'MOCK'];

function CountsTable({ data, totalLabel = 'المجموع' }:
  { data: Record<string, number>; totalLabel?: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, v]) => n + v, 0);
  return (
    <table className="keep w-full border-collapse text-[11px]">
      <thead>
        <tr className="bg-page/60 text-[10px] text-ink-700">
          {entries.map(([k]) => <th key={k} className={PCELL}>{k}</th>)}
          <th className={PCELL}>{totalLabel}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          {entries.map(([k, v]) => (
            <td key={k} className={PCELL}><Num>{toArabicDigits(v)}</Num></td>))}
          <td className={`${PCELL} font-bold`}><Num>{toArabicDigits(total)}</Num></td>
        </tr>
      </tbody>
    </table>
  );
}

function AssociationSheet() {
  const db = useDB();
  const sp = useSearchParams();
  const from = sp.get('from');
  const to = sp.get('to');
  const period = !!(from || to);

  const d = useMemo(() => derive(db), [db]);
  const readyByHalaqa = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of followUpRows(db)) {
      if (r.student.status !== 'ACTIVE' || !r.ready.ready || !r.student.halaqaId) continue;
      m.set(r.student.halaqaId, (m.get(r.student.halaqaId) ?? 0) + 1);
    }
    return m;
  }, [db]);

  const examCounts = useMemo(() => {
    const m = new Map<string, { total: number; passed: number }>();
    for (const e of db.exams) {
      if (from && e.takenOn < from) continue;
      if (to && e.takenOn > to) continue;
      const c = m.get(e.type) ?? { total: 0, passed: 0 };
      c.total++;
      if (e.passed === true) c.passed++;
      m.set(e.type, c);
    }
    return m;
  }, [db.exams, from, to]);

  const teachers = new Set(db.halaqat.map((h) => h.teacher)).size;

  const stat = (label: string, value: number) => (
    <div className="rounded-md border border-ink-200 px-3 py-2 text-center">
      <span className="block font-display text-h2 leading-tight text-assoc-900">
        <Num>{toArabicDigits(value)}</Num>
      </span>
      <span className="text-micro text-ink-600">{label}</span>
    </div>
  );

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between gap-4 px-2">
        <p className="text-panel text-ink-600">
          {period
            ? 'نسخة الفترة — حصيلة الاختبارات محصورة بالتاريخين، وأرقام القيد بحالتها اليوم.'
            : 'النسخة التراكمية — أضف فترة من شاشة التقارير إن أردت شهرًا أو فصلًا بعينه.'}
        </p>
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead assoc title="إحصاءات الحلقات"
          sub={period
            ? <>الفترة {from && <>من <Num>{toArabicDigits(formatDate(from))}</Num></>}{' '}
                {to && <>إلى <Num>{toArabicDigits(formatDate(to))}</Num></>} — مرفوع إلى جمعية تحفيظ الشرقية</>
            : 'تراكمي منذ بداية التشغيل — مرفوع إلى جمعية تحفيظ الشرقية'} />

        {d.isEmpty ? (
          <p className="py-12 text-center text-lg2 text-ink-500">القاعدة فارغة — لا شيء يُحصى بعد.</p>
        ) : (
          <>
            <div className="keep grid grid-cols-4 gap-2">
              {stat('طالبًا مقيّدًا', d.students)}
              {stat('نشطون', d.activeStudents)}
              {stat('حلقات', d.halaqat)}
              {stat('معلمون', teachers)}
            </div>

            <PrintSec assoc>المسارات</PrintSec>
            <CountsTable data={d.tracks} />

            <PrintSec assoc>المراحل الدراسية</PrintSec>
            <CountsTable data={d.stages} />

            <PrintSec assoc>الجنسيات</PrintSec>
            <CountsTable data={d.nationalities} />

            <PrintSec assoc>حصيلة الاختبارات{period ? ' — خلال الفترة' : ''}</PrintSec>
            <table className="keep w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-page/60 text-[10px] text-ink-700">
                  <th className={PCELL}>النوع</th>
                  {EXAM_ORDER.map((t) => <th key={t} className={PCELL}>{EXAM_TYPE_AR[t]}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className={`${PCELL} bg-page/60 font-medium`}>أُجري</th>
                  {EXAM_ORDER.map((t) => (
                    <td key={t} className={PCELL}>
                      <Num>{toArabicDigits(examCounts.get(t)?.total ?? 0)}</Num>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className={`${PCELL} bg-page/60 font-medium`}>اجتازوا</th>
                  {EXAM_ORDER.map((t) => (
                    <td key={t} className={PCELL}>
                      <Num>{toArabicDigits(examCounts.get(t)?.passed ?? 0)}</Num>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            <PrintSec assoc>الحلقات</PrintSec>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-page/60 text-[10px] text-ink-700">
                  {['الحلقة', 'الوقت', 'الطلاب', 'جاهزون لاختبار الجمعية الآن'].map((h) => (
                    <th key={h} className={PCELL}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {d.byHalaqa.map((h) => (
                  <tr key={h.id} className="keep">
                    <td className={`${PCELL} text-start`}>{shortName(h.teacher)}</td>
                    <td className={PCELL}>{h.timeSlot || '—'}</td>
                    <td className={PCELL}><Num>{toArabicDigits(h.n)}</Num></td>
                    <td className={PCELL}><Num>{toArabicDigits(readyByHalaqa.get(h.id) ?? 0)}</Num></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <PrintFoot>
          «جاهز»: أتمّ الجزء واجتاز الوسام الماسي عليه، ولم تختبره الجمعية على هذا الجزء بعد.
        </PrintFoot>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><AssociationSheet /></Suspense>;
}
