'use client';
/* التقرير الشامل للطالب — SPEC.md §6.11 (إد-٥-هـ), layout approved 1 Sep 2026.
   One page into the student's file or the guardian's hand: identity, the
   current level and its sheet, every exam, the ledger's summary with the last
   movements, and the latest Ratel snapshot. Talqeen students get identity,
   exams and Ratel only — §4.11 keeps them outside plans and points. */
import { Suspense, use, useMemo } from 'react';
import { Printer } from 'lucide-react';
import { PrintHead, PrintFoot, PrintSec, PCELL, PCELL_TIGHT } from '@/components/PrintHead';
import { Num, toArabicDigits, plural } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { followUpRows } from '@/lib/followup';
import { scoreMax } from '@/lib/exams';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { TRACK_AR, STATUS_AR, TXN_KIND_AR, PLAN_KIND_AR, PLAN_KIND_ORDER } from '@/lib/types';
import { halaqaLabel, shortName  } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';
import { useAttendance } from '@/components/useAttendance';
import { useParts } from '@/lib/reportParts';
import { cx } from '@/lib/cx';

/* «خلني اقدر اختار وش اطبع» (client, 10 Oct 2026): every block below is a
   part the supervisor switches on or off in the reports panel
   (lib/reportParts → `student`). Nothing is cut to fit one page any more — a
   file chosen in full runs onto a second sheet, with the table headers
   repeated, rather than silently dropping the eighteenth exam. */
const LEDGER_ROWS = 8;

const DAY_AR: Record<string, string> = { PRESENT: 'حاضر', LATE: 'متأخر', ABSENT: 'غائب' };
const WEEKDAY = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const weekday = (iso: string) => WEEKDAY[new Date(`${iso}T12:00:00`).getDay()];

function StudentReport({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const db = useDB();
  const show = useParts('student');
  const att = useAttendance({ student: studentId });
  const me = att?.students[studentId] ?? null;
  const days = att?.days ?? [];

  const row = useMemo(
    () => followUpRows(db).find((r) => r.student.id === studentId) ?? null, [db, studentId]);
  const exams = useMemo(() => db.exams
    .filter((e) => e.studentId === studentId)
    .sort((a, b) => (a.takenOn < b.takenOn ? 1 : a.takenOn > b.takenOn ? -1
      : (a.createdAt < b.createdAt ? 1 : -1))), [db.exams, studentId]);
  const questionsOf = useMemo(() => {
    const m = new Map<string, typeof db.examQuestions>();
    for (const q of db.examQuestions) m.set(q.examId, [...(m.get(q.examId) ?? []), q]);
    for (const list of m.values()) list.sort((a, b) => a.seq - b.seq);
    return m;
  }, [db.examQuestions]);
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
  const hasRatel = s.attendedDays !== undefined || s.hifzPages !== undefined;

  const TH = `${PCELL} w-[92px] bg-page/60 font-medium`;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead title="تقرير طالب" sub={`${s.fullName} — ${halaqa ? `حلقة ${halaqaLabel(shortName(halaqa.teacher))}` : 'بلا حلقة'}`} />

        {show('info') && (
          <table className="keep w-full table-fixed border-collapse text-[11.5px]">
            <tbody>
              <tr>
                <th className={TH}>الطالب</th>
                <td className={`${PCELL} text-start`} colSpan={3}>{s.fullName}</td>
                <th className={TH}>رقم الهوية</th>
                <td className={PCELL}>{s.nationalId ? <Num>{toArabicDigits(s.nationalId)}</Num> : '—'}</td>
              </tr>
              <tr>
                <th className={TH}>الحلقة</th>
                <td className={PCELL}>{halaqa ? halaqaLabel(shortName(halaqa.teacher)) : 'بلا حلقة'}</td>
                <th className={TH}>المسار</th>
                <td className={PCELL}>{s.track ? TRACK_AR[s.track] : '—'}</td>
                <th className={TH}>الصف</th>
                <td className={PCELL}>{s.grade || '—'}</td>
              </tr>
              <tr>
                <th className={TH}>الجنسية</th>
                <td className={PCELL}>{s.nationality || '—'}</td>
                <th className={TH}>المرحلة</th>
                <td className={PCELL}>{s.stage || '—'}</td>
                <th className={TH}>الحالة</th>
                <td className={PCELL}>{STATUS_AR[s.status]}</td>
              </tr>
            </tbody>
          </table>
        )}

        {!talqeen && show('plan') && (
          <>
            <PrintSec>المستوى والخطة</PrintSec>
            {row.plan ? (
              <table className="keep w-full table-fixed border-collapse text-[11.5px]">
                <tbody>
                  <tr>
                    <th className={TH}>المستوى الحالي</th>
                    <td className={PCELL}><Num>{toArabicDigits(s.currentLevel ?? row.plan.level)}</Num></td>
                    <th className={TH}>استلم الخطة</th>
                    <td className={PCELL}><Num>{toArabicDigits(formatDate(row.plan.issuedAt))}</Num></td>
                    <th className={TH}>أيام على المستوى</th>
                    <td className={PCELL}>
                      <Num>{toArabicDigits(row.daysHeld ?? 0)}</Num>
                      {row.late && <span className="ms-1 text-warn-700">· متأخر</span>}
                    </td>
                  </tr>
                  <tr>
                    <th className={TH}>المقرَّر اليومي</th>
                    <td className={PCELL} colSpan={5}>{row.plan.dailyAmount || '—'}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-[11.5px] text-ink-500">لا توجد خطة مُصدرة.</p>
            )}
          </>
        )}

        {show('exams') && (
          <>
            <PrintSec>الاختبارات</PrintSec>
            {exams.length === 0 ? (
              <p className="text-[11.5px] text-ink-500">لم يُختبر بعد.</p>
            ) : (
              <table className="w-full table-fixed border-collapse text-[10.5px]">
                <colgroup>
                  <col className="w-[72px]" /><col /><col className="w-[44px]" /><col className="w-[44px]" />
                  <col className="w-[56px]" /><col className="w-[52px]" /><col className="w-[34%]" />
                </colgroup>
                <thead>
                  <tr className="bg-page/60 text-[10px] text-ink-700">
                    {['التاريخ', 'النوع', 'المستوى', 'الأجزاء', 'الدرجة', 'النتيجة', 'ملاحظة'].map((h) => (
                      <th key={h} className={PCELL_TIGHT}>{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {exams.map((e) => (
                    <tr key={e.id}>
                      <td className={PCELL_TIGHT}><Num>{toArabicDigits(formatDate(e.takenOn))}</Num></td>
                      <td className={PCELL_TIGHT}>
                        {EXAM_TYPE_AR[e.type as ExamType] ?? e.type}
                        {e.tajweedTopics.length ? ` — ${e.tajweedTopics.join('، ')}` : ''}
                      </td>
                      <td className={PCELL_TIGHT}>{e.level != null ? <Num>{toArabicDigits(e.level)}</Num> : '—'}</td>
                      <td className={PCELL_TIGHT}>{e.ajza != null ? <Num>{toArabicDigits(e.ajza)}</Num> : '—'}</td>
                      <td className={PCELL_TIGHT}>
                        {e.score != null
                          ? <Num>{`${toArabicDigits(e.score)}/${toArabicDigits(scoreMax(e.type))}`}</Num>
                          : '—'}
                      </td>
                      <td className={PCELL_TIGHT}>
                        {e.passed === null ? '—'
                          : e.passed ? <span className="text-ok-700">اجتاز</span>
                          : <span className="text-risk-700">لم يجتز</span>}
                      </td>
                      <td className={`${PCELL_TIGHT} text-start text-[10px]`}>{e.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* أسئلة كل اختبار وأخطاؤها — what the supervisor sees on the exam's
            own page, sitting by sitting. Off by default: it is long. */}
        {show('questions') && exams.some((e) => (questionsOf.get(e.id) ?? []).length > 0) && (
          <>
            <PrintSec>أسئلة الاختبارات وأخطاؤها</PrintSec>
            {exams.filter((e) => (questionsOf.get(e.id) ?? []).length > 0).map((e) => (
              <div key={e.id} className="keep mb-2">
                <p className="mb-0.5 text-[10.5px] font-medium text-ink-800">
                  {EXAM_TYPE_AR[e.type as ExamType] ?? e.type} ·{' '}
                  <Num>{toArabicDigits(formatDate(e.takenOn))}</Num>
                  {e.score != null && <> · <Num>{`${toArabicDigits(e.score)}/${toArabicDigits(scoreMax(e.type))}`}</Num></>}
                </p>
                <table className="w-full table-fixed border-collapse text-[10px]">
                  <colgroup>
                    <col className="w-[28px]" /><col className="w-[110px]" /><col className="w-[80px]" />
                    <col className="w-[48px]" /><col className="w-[52px]" /><col className="w-[48px]" /><col />
                  </colgroup>
                  <thead>
                    <tr className="bg-page/60 text-ink-700">
                      {['#', 'السورة', 'الآيات', 'أخطاء', 'تنبيهات', 'تجويد', 'ملاحظة'].map((h) => (
                        <th key={h} className={PCELL_TIGHT}>{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {(questionsOf.get(e.id) ?? []).map((q) => (
                      <tr key={q.id}>
                        <td className={PCELL_TIGHT}><Num>{toArabicDigits(q.seq)}</Num></td>
                        <td className={PCELL_TIGHT}>{q.surah || '—'}</td>
                        <td className={PCELL_TIGHT}>
                          {q.ayahFrom ? <Num>{toArabicDigits(q.ayahTo ? `${q.ayahFrom}–${q.ayahTo}` : q.ayahFrom)}</Num> : '—'}
                        </td>
                        <td className={cx(PCELL_TIGHT, q.errors > 0 && 'text-risk-700')}><Num>{toArabicDigits(q.errors)}</Num></td>
                        <td className={cx(PCELL_TIGHT, q.warnings > 0 && 'text-warn-700')}><Num>{toArabicDigits(q.warnings)}</Num></td>
                        <td className={cx(PCELL_TIGHT, q.tajweedErrors > 0 && 'text-info-700')}><Num>{toArabicDigits(q.tajweedErrors)}</Num></td>
                        <td className={`${PCELL_TIGHT} text-start`}>{q.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}

        {!talqeen && show('points') && (
          <>
            <PrintSec>النقاط</PrintSec>
            <table className="keep w-full table-fixed border-collapse text-[11.5px]">
              <tbody>
                <tr>
                  <th className={TH}>الرصيد الحالي</th>
                  <td className={PCELL}>
                    <Num className="font-bold text-brand-800">{toArabicDigits(row.balance)}</Num> نقطة
                  </td>
                  <th className={TH}>مجموع ما اكتسب</th>
                  <td className={PCELL}><Num>{toArabicDigits(granted)}</Num></td>
                  <th className={TH}>مجموع ما صرف</th>
                  <td className={PCELL}><Num>{toArabicDigits(redeemed)}</Num></td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {!talqeen && show('ledger') && txns.length > 0 && (
          <>
            {!show('points') && <PrintSec>النقاط</PrintSec>}
            <table className="mt-2 w-full table-fixed border-collapse text-[10.5px]">
              <colgroup><col className="w-[80px]" /><col className="w-[80px]" /><col /><col className="w-[64px]" /></colgroup>
              <thead>
                <tr className="bg-page/60 text-[10px] text-ink-700">
                  {['التاريخ', 'الحركة', 'السبب', 'المقدار'].map((h) => (
                    <th key={h} className={PCELL_TIGHT}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, LEDGER_ROWS).map((t) => (
                  <tr key={t.id}>
                    <td className={PCELL_TIGHT}><Num>{toArabicDigits(formatDate(t.createdAt))}</Num></td>
                    <td className={PCELL_TIGHT}>{TXN_KIND_AR[t.kind]}</td>
                    <td className={`${PCELL_TIGHT} text-start`}>{t.reason}</td>
                    <td className={PCELL_TIGHT}>
                      {/* The sign INSIDE the isolate, or RTL flips «−٢٢٠» into «٢٢٠−». */}
                      <Num className={t.delta >= 0 ? 'text-ok-700' : 'text-risk-700'}>
                        {`${t.delta >= 0 ? '+' : '−'}${toArabicDigits(Math.abs(t.delta))}`}
                      </Num>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* حضوره وتسميعه — من سجلّ معلمه. «شيل كلمة أسطر» (client, 10 Oct
            2026): the count of lines meant nothing to the reader; the errors
            are what he asks about. */}
        {show('attendance') && me && me.recorded > 0 && (
          <>
            <PrintSec>الحضور والتسميع</PrintSec>
            <table className="keep w-full table-fixed border-collapse text-[11.5px]">
              <tbody>
                <tr>
                  <th className={TH}>الحضور</th>
                  <td className={PCELL}>
                    <Num>{toArabicDigits(me.attended)}</Num> من{' '}
                    <Num>{toArabicDigits(me.recorded)}</Num>
                    {me.rate !== null && <> · <Num>{toArabicDigits(me.rate)}</Num>٪</>}
                  </td>
                  <th className={TH}>متأخر</th>
                  <td className={PCELL}><Num>{toArabicDigits(me.late)}</Num></td>
                  <th className={TH}>غائب</th>
                  <td className={PCELL}><Num>{toArabicDigits(me.absent)}</Num></td>
                </tr>
                <tr>
                  <th className={TH}>أيام سمّع فيها</th>
                  <td className={PCELL}><Num>{toArabicDigits(me.recitedDays)}</Num></td>
                  <th className={TH}>الأخطاء</th>
                  <td className={PCELL}><Num>{toArabicDigits(me.errors)}</Num></td>
                  <th className={TH}>آخر حضور</th>
                  <td className={PCELL}>
                    {me.lastAttended ? <Num>{toArabicDigits(formatDate(me.lastAttended))}</Num> : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* «تفصيل بحضوره وش الأيام الي حضرها ووش سمع فيها» — every afternoon
            his teacher recorded, newest first: the day, his status and ثوب,
            and each of the three lines with its passage and its errors. */}
        {show('days') && days.length > 0 && (
          <>
            <PrintSec>الحضور يومًا بيوم</PrintSec>
            <table className="w-full table-fixed border-collapse text-[10px]">
              <colgroup>
                <col className="w-[84px]" /><col className="w-[44px]" /><col className="w-[30px]" />
                <col /><col /><col />
              </colgroup>
              <thead>
                <tr className="bg-page/60 text-ink-700">
                  {['اليوم', 'الحضور', 'الثوب', ...(talqeen ? ['التلقين', '', ''] : PLAN_LINES)].map((h, i) => (
                    <th key={i} className={PCELL_TIGHT}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const absent = d.status === 'ABSENT';
                  return (
                    <tr key={d.day} className={cx(absent && 'bg-risk-100/50')}>
                      <td className={`${PCELL_TIGHT} whitespace-nowrap`}>
                        {weekday(d.day)} <Num>{toArabicDigits(formatDate(d.day).slice(5))}</Num>
                      </td>
                      <td className={cx(PCELL_TIGHT, absent ? 'text-risk-700' : d.status === 'LATE' ? 'text-warn-700' : 'text-ok-700')}>
                        {DAY_AR[d.status] ?? d.status}
                      </td>
                      <td className={PCELL_TIGHT}>{absent ? '' : d.thobe ? '✓' : '✗'}</td>
                      {absent ? (
                        <td className={`${PCELL_TIGHT} text-ink-400`} colSpan={3}>{d.note || ''}</td>
                      ) : talqeen ? (
                        <td className={`${PCELL_TIGHT} text-start`} colSpan={3}>
                          {d.talqeen ? <>{d.talqeen.surah} <Num>{toArabicDigits(d.talqeen.ayah)}</Num></> : '—'}
                        </td>
                      ) : d.lines.map((l) => (
                        <td key={l.kind} className={`${PCELL_TIGHT} text-start leading-snug`}>
                          {l.recited ? (
                            <>
                              <span className="text-ink-800">{l.passage ? toArabicDigits(l.passage) : 'سمّع'}</span>
                              {l.errors > 0 && (
                                <span className="ms-1 text-risk-700">· <Num>{toArabicDigits(l.errors)}</Num> خطأ</span>
                              )}
                            </>
                          ) : <span className="text-ink-400">لم يسمّع</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {show('ratel') && hasRatel && (
          <>
            <PrintSec>آخر لقطة أسبوعية</PrintSec>
            <table className="keep w-full table-fixed border-collapse text-[11.5px]">
              <tbody>
                <tr>
                  <th className={TH}>أيام الحضور</th>
                  <td className={PCELL}>{s.attendedDays === undefined ? '—' : <Num>{toArabicDigits(s.attendedDays)}</Num>}</td>
                  <th className={TH}>أوجه الحفظ</th>
                  <td className={PCELL}>{s.hifzPages !== undefined ? <Num>{toArabicDigits(s.hifzPages)}</Num> : '—'}</td>
                  <th className={TH}>أوجه المراجعة</th>
                  <td className={PCELL}>{s.reviewPages !== undefined ? <Num>{toArabicDigits(s.reviewPages)}</Num> : '—'}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <PrintFoot />
      </div>
    </>
  );
}

/** The three lines in the order the sheet prints them, named in full —
    the curriculum's short forms («م.ك») mean nothing to a parent. */
const LINE_NAME: Record<string, string> = {
  MURAJAA_KUBRA: 'المراجعة الكبرى', MURAJAA_SUGHRA: 'المراجعة الصغرى', DARS: 'الدرس',
};
const PLAN_LINES = PLAN_KIND_ORDER.map((k) => LINE_NAME[k] ?? PLAN_KIND_AR[k]);

export default function Page(props: { params: Promise<{ studentId: string }> }) {
  return <Suspense><StudentReport {...props} /></Suspense>;
}
