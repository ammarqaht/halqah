'use client';
/* التقرير الشامل للطالب — SPEC.md §6.11 (إد-٥-هـ), layout approved 1 Sep 2026.
   One page into the student's file or the guardian's hand: identity, the
   current level and its sheet, every exam, the ledger's summary with the last
   movements, and the latest Ratel snapshot. Talqeen students get identity,
   exams and Ratel only — §4.11 keeps them outside plans and points. */
import { use, useMemo } from 'react';
import { Printer } from 'lucide-react';
import { PrintHead, PrintFoot, PrintSec, PCELL } from '@/components/PrintHead';
import { Num, toArabicDigits, plural } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { followUpRows } from '@/lib/followup';
import { scoreMax } from '@/lib/exams';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { TRACK_AR, STATUS_AR, TXN_KIND_AR } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

const MAX_EXAM_ROWS = 14;
const MAX_TXN_ROWS = 5;

export default function StudentReport({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const db = useDB();

  const row = useMemo(
    () => followUpRows(db).find((r) => r.student.id === studentId) ?? null, [db, studentId]);
  const exams = useMemo(() => db.exams
    .filter((e) => e.studentId === studentId)
    .sort((a, b) => (a.takenOn < b.takenOn ? 1 : a.takenOn > b.takenOn ? -1
      : (a.createdAt < b.createdAt ? 1 : -1))), [db.exams, studentId]);
  const txns = useMemo(() => db.txns
    .filter((t) => t.studentId === studentId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [db.txns, studentId]);

  if (!row) {
    return (
      <div className="sheet-a4 font-sans" dir="rtl">
        <p className="text-lg2 text-ink-700">لا طالب بهذا الرقم.</p>
        <p className="mt-2 text-base2 text-ink-500">افتح التقرير من شاشة التقارير.</p>
      </div>
    );
  }

  const s = row.student;
  const halaqa = s.halaqaId ? db.halaqat.find((h) => h.id === s.halaqaId) ?? null : null;
  const granted = txns.filter((t) => t.delta > 0).reduce((n, t) => n + t.delta, 0);
  const redeemed = txns.filter((t) => t.delta < 0).reduce((n, t) => n - t.delta, 0);
  const talqeen = s.track === 'TALQEEN';
  const hasRatel = s.attended !== undefined || s.hifzPages !== undefined;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead title="تقرير طالب" sub="حلقات جامع محمد العبدالكريم — الدمام، حي أُحد" />

        <table className="keep w-full border-collapse text-sm2">
          <tbody>
            <tr>
              <th className={`${PCELL} bg-page/60 font-medium`}>الطالب</th>
              <td className={`${PCELL} text-start`} colSpan={3}>{s.fullName}</td>
              <th className={`${PCELL} bg-page/60 font-medium`}>رقم الهوية</th>
              <td className={PCELL}>{s.nationalId ? <Num>{toArabicDigits(s.nationalId)}</Num> : '—'}</td>
            </tr>
            <tr>
              <th className={`${PCELL} bg-page/60 font-medium`}>الحلقة</th>
              <td className={PCELL}>
                {halaqa ? `${shortName(halaqa.teacher)} · ${halaqa.timeSlot}` : 'بلا حلقة'}
              </td>
              <th className={`${PCELL} bg-page/60 font-medium`}>المسار</th>
              <td className={PCELL}>{s.track ? TRACK_AR[s.track] : '—'}</td>
              <th className={`${PCELL} bg-page/60 font-medium`}>الصف</th>
              <td className={PCELL}>{s.grade || '—'}</td>
            </tr>
            <tr>
              <th className={`${PCELL} bg-page/60 font-medium`}>الجنسية</th>
              <td className={PCELL}>{s.nationality || '—'}</td>
              <th className={`${PCELL} bg-page/60 font-medium`}>المرحلة</th>
              <td className={PCELL}>{s.stage || '—'}</td>
              <th className={`${PCELL} bg-page/60 font-medium`}>الحالة</th>
              <td className={PCELL}>{STATUS_AR[s.status]}</td>
            </tr>
          </tbody>
        </table>

        {!talqeen && (
          <>
            <PrintSec>المستوى والخطة</PrintSec>
            {row.plan ? (
              <table className="keep w-full border-collapse text-sm2">
                <tbody>
                  <tr>
                    <th className={`${PCELL} bg-page/60 font-medium`}>المستوى الحالي</th>
                    <td className={PCELL}><Num>{toArabicDigits(s.currentLevel ?? row.plan.level)}</Num></td>
                    <th className={`${PCELL} bg-page/60 font-medium`}>تاريخ الإصدار</th>
                    <td className={PCELL}><Num>{toArabicDigits(formatDate(row.plan.issuedAt))}</Num></td>
                    <th className={`${PCELL} bg-page/60 font-medium`}>الأيام منذ الإصدار</th>
                    <td className={PCELL}>
                      <Num>{toArabicDigits(row.daysHeld ?? 0)}</Num>
                      {row.late && <span className="ms-1 text-warn-700">· متأخر</span>}
                    </td>
                    <th className={`${PCELL} bg-page/60 font-medium`}>المقرَّر اليومي</th>
                    <td className={PCELL}>{row.plan.dailyAmount}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-sm2 text-ink-500">لا توجد خطة مُصدرة.</p>
            )}
          </>
        )}

        <PrintSec>الاختبارات</PrintSec>
        {exams.length === 0 ? (
          <p className="text-sm2 text-ink-500">لم يُختبر بعد.</p>
        ) : (
          <>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-page/60 text-[10px] text-ink-700">
                  {['التاريخ', 'النوع', 'المستوى', 'الأجزاء', 'الدرجة', 'النتيجة', 'ملاحظة'].map((h) => (
                    <th key={h} className={PCELL}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {exams.slice(0, MAX_EXAM_ROWS).map((e) => (
                  <tr key={e.id} className="keep">
                    <td className={PCELL}><Num>{toArabicDigits(formatDate(e.takenOn))}</Num></td>
                    <td className={PCELL}>
                      {EXAM_TYPE_AR[e.type as ExamType] ?? e.type}
                      {e.tajweedTopics.length ? ` — ${e.tajweedTopics.join('، ')}` : ''}
                    </td>
                    <td className={PCELL}>{e.level != null ? <Num>{toArabicDigits(e.level)}</Num> : '—'}</td>
                    <td className={PCELL}>{e.ajza != null ? <Num>{toArabicDigits(e.ajza)}</Num> : '—'}</td>
                    <td className={PCELL}>
                      {e.score != null
                        ? <Num>{`${toArabicDigits(e.score)}/${toArabicDigits(scoreMax(e.type))}`}</Num>
                        : '—'}
                    </td>
                    <td className={PCELL}>
                      {e.passed === null ? '—'
                        : e.passed ? <span className="text-ok-700">اجتاز</span>
                        : <span className="text-risk-700">لم يجتز</span>}
                    </td>
                    <td className={`${PCELL} text-start text-[10px]`}>{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {exams.length > MAX_EXAM_ROWS && (
              <p className="mt-1 text-micro text-ink-500">
                يُعرض آخر {toArabicDigits(plural(MAX_EXAM_ROWS, 'اختبار', 'اختبارين', 'اختبارات', 'اختبارًا'))} —
                والبقية في سجلّ الاختبارات.
              </p>
            )}
          </>
        )}

        {!talqeen && (
          <>
            <PrintSec>النقاط</PrintSec>
            <table className="keep mb-2 w-full border-collapse text-sm2">
              <tbody>
                <tr>
                  <th className={`${PCELL} bg-page/60 font-medium`}>الرصيد الحالي</th>
                  <td className={PCELL}>
                    <Num className="font-bold text-brand-800">{toArabicDigits(row.balance)}</Num> نقطة
                  </td>
                  <th className={`${PCELL} bg-page/60 font-medium`}>مجموع ما اكتسب</th>
                  <td className={PCELL}><Num>{toArabicDigits(granted)}</Num></td>
                  <th className={`${PCELL} bg-page/60 font-medium`}>مجموع ما صرف</th>
                  <td className={PCELL}><Num>{toArabicDigits(redeemed)}</Num></td>
                </tr>
              </tbody>
            </table>
            {txns.length > 0 && (
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-page/60 text-[10px] text-ink-700">
                    {['التاريخ', 'الحركة', 'السبب', 'المقدار'].map((h) => (
                      <th key={h} className={PCELL}>{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {txns.slice(0, MAX_TXN_ROWS).map((t) => (
                    <tr key={t.id} className="keep">
                      <td className={PCELL}><Num>{toArabicDigits(formatDate(t.createdAt))}</Num></td>
                      <td className={PCELL}>{TXN_KIND_AR[t.kind]}</td>
                      <td className={`${PCELL} text-start`}>{t.reason}</td>
                      <td className={PCELL}>
                        {/* The sign INSIDE the isolate, or RTL flips «−٢٢٠» into «٢٢٠−». */}
                        <Num className={t.delta >= 0 ? 'text-ok-700' : 'text-risk-700'}>
                          {`${t.delta >= 0 ? '+' : '−'}${toArabicDigits(Math.abs(t.delta))}`}
                        </Num>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {hasRatel && (
          <>
            <PrintSec>لقطة رتل الأسبوعية</PrintSec>
            <table className="keep w-full border-collapse text-sm2">
              <tbody>
                <tr>
                  <th className={`${PCELL} bg-page/60 font-medium`}>الحضور</th>
                  <td className={PCELL}>
                    {s.attended === undefined ? '—' : s.attended ? 'حاضر' : 'غائب'}
                  </td>
                  <th className={`${PCELL} bg-page/60 font-medium`}>أوجه الحفظ</th>
                  <td className={PCELL}>{s.hifzPages !== undefined ? <Num>{toArabicDigits(s.hifzPages)}</Num> : '—'}</td>
                  <th className={`${PCELL} bg-page/60 font-medium`}>أوجه المراجعة</th>
                  <td className={PCELL}>{s.reviewPages !== undefined ? <Num>{toArabicDigits(s.reviewPages)}</Num> : '—'}</td>
                  <th className={`${PCELL} bg-page/60 font-medium`}>آخر ملف</th>
                  <td className={PCELL}>
                    {db.importedAt ? <Num>{toArabicDigits(formatDate(db.importedAt))}</Num> : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <PrintFoot>
          {talqeen ? 'مسار التلقين خارج نظام الخطط والنقاط — تُتابَع اختباراته وحضوره فقط.' : ''}
        </PrintFoot>
      </div>
    </>
  );
}
