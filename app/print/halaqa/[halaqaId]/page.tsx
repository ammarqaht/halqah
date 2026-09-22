'use client';
/* تقرير حلقة المعلّم — SPEC.md §6.11 (إد-٥-هـ), layout approved 1 Sep 2026.
   The teacher's whole roster on one sheet, and the client's manual green
   highlighting replaced structurally: the row is shaded AND carries a mark in
   its own column, so it survives a greyscale photocopier (DESIGN.md §1.4 —
   colour is never the only carrier).

   THE SHADING IS FOR PASSING, not for sitting — 22 Sep 2026. It used to fall
   on everyone the association had examined, so a boy who failed printed the
   same green as one who passed, and the sheet was being read at a glance by
   someone who could not tell them apart. A pass is «✓ ٣» — the mark and how
   many ajza it covered; a failure is «✗ ٣» on an unshaded row. */
import { use, useMemo } from 'react';
import { Printer } from 'lucide-react';
import { PrintHead, PrintFoot, PCELL } from '@/components/PrintHead';
import { Num, toArabicDigits, plural } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { followUpRows, followedRows } from '@/lib/followup';
import { EXAM_TYPE_SHORT_AR, type ExamType } from '@/lib/points';
import { TRACK_AR } from '@/lib/types';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';
import { useAttendance } from '@/components/useAttendance';

export default function HalaqaReport({ params }: { params: Promise<{ halaqaId: string }> }) {
  const { halaqaId } = use(params);
  const db = useDB();
  const att = useAttendance({ halaqa: halaqaId });

  const halaqa = db.halaqat.find((h) => h.id === halaqaId) ?? null;
  const rows = useMemo(() => followedRows(followUpRows(db))
    .filter((r) => r.student.halaqaId === halaqaId)
    .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, 'ar')),
  [db, halaqaId]);

  /* The halaqa's attendance rate, over every afternoon actually RECORDED —
     not an average of per-boy averages, so a student with three records does
     not weigh the same as one with thirty. Null before the first save: a
     percentage with no register behind it is an invention. */
  const attRate = att && att.total.recorded > 0 ? att.total.rate : null;

  if (!halaqa) {
    return (
      <div className="sheet-a4 font-sans" dir="rtl">
        <p className="text-lg2 text-ink-700">لا حلقة بهذا الرقم.</p>
        <p className="mt-2 text-base2 text-ink-500">افتح التقرير من شاشة التقارير.</p>
      </div>
    );
  }

  /* عدّان لا واحد: التظليل صار للناجح، فعدّ «من اختُبر» وحده يترك القارئ
     يحسب الفرق بنفسه — وهو الرقم الذي جاء يقرأ الورقة لأجله. */
  const passed = rows.filter((r) => r.lastAssociation?.passed === true).length;
  const failed = rows.filter((r) => r.lastAssociation && r.lastAssociation.passed !== true).length;

  return (
    <>
      {/* عرضيّ — 22 Sep 2026: thirteen columns, two of them a passage and a
          note, do not fit a portrait page without crushing the names. A page
          box is per-DOCUMENT, so the sheet declares its own. */}
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
      <div className="no-print mx-auto mb-4 flex w-[1123px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 landscape font-sans" dir="rtl">
        <PrintHead title={`تقرير حلقة ${halaqa.teacher}`}
          sub={`جامع محمد العبدالكريم — ${toArabicDigits(plural(rows.length, 'طالب واحد', 'طالبان', 'طلاب', 'طالبًا'))}`
            + (attRate !== null ? ` · الحضور ${toArabicDigits(attRate)}٪ من ${toArabicDigits(att!.total.recorded)} تسجيلًا` : '')} />

        {rows.length === 0 ? (
          <p className="py-12 text-center text-lg2 text-ink-500">لا طلاب نشطين في هذه الحلقة.</p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-page/60 text-[10px] text-ink-700">
                {/* «الحضور» is the REGISTER's — what his teacher marked,
                    afternoon by afternoon, not the uploaded file's term total.
                    The two exam blocks are separate on purpose: the association
                    is the outward milestone and reads on its own, and «آخر
                    اختبار» beside it is whatever he sat last, with the level he
                    sat it on, his mark, and the examiner's note. */}
                {['#', 'الطالب', 'الصف', 'الحضور', 'المستوى', 'استلم الخطة', 'آخر درس',
                  'الجمعية', 'الجزء', 'آخر اختبار', 'مستواه', 'الدرجة', 'ملاحظة'].map((h) => (
                  <th key={h} className={PCELL}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const s = r.student;
                /* ONE definition of «آخر اختبار» — the row's own, so this
                   paper can never disagree with the follow-up screen. */
                const last = r.lastExam;
                /* اختبرته الجمعية، واجتاز. كان التظليل يقع على كل من اختُبر —
                   فالراسب يظهر في اللون نفسه الذي يظهر فيه الناجح، وورقة تُقرأ
                   بلمحة لا تحتمل ذلك. */
                const assoc = r.lastAssociation;
                const assocPassed = assoc?.passed === true;
                return (
                  <tr key={s.id} className={cx('keep h-[26px]', assocPassed && 'bg-ok-100')}>
                    <td className={PCELL}><Num>{toArabicDigits(i + 1)}</Num></td>
                    <td className={`${PCELL} whitespace-nowrap text-start`}>{s.fullName}</td>
                    <td className={PCELL}>{s.grade || '—'}</td>
                    <td className={PCELL}>
                      {(() => {
                        const a = att?.students[s.id];
                        if (!a || a.recorded === 0) return '—';
                        return (<>
                          <Num>{toArabicDigits(a.attended)}</Num>
                          <span className="text-ink-500">/<Num>{toArabicDigits(a.recorded)}</Num></span>
                        </>);
                      })()}
                    </td>
                    {/* المسار والمستوى في خلية واحدة: «ذهبي ١٥». */}
                    <td className={`${PCELL} whitespace-nowrap`}>
                      {!s.track ? '—' : (<>
                        {TRACK_AR[s.track]}
                        {s.track !== 'TALQEEN' && s.currentLevel != null && (
                          <> <Num>{toArabicDigits(s.currentLevel)}</Num></>
                        )}
                      </>)}
                    </td>
                    {/* متى أخذ ورقته — الجواب عن «كم صار له على هذا المستوى؟»
                        بلا حساب، وهو أوّل ما يُسأل عن المتأخّر. */}
                    <td className={`${PCELL} whitespace-nowrap`}>
                      {r.plan?.issuedAt
                        ? <Num>{toArabicDigits(formatDate(r.plan.issuedAt))}</Num>
                        : '—'}
                    </td>
                    <td className={`${PCELL} whitespace-nowrap`}>
                      {(() => {
                        const l = att?.lastLesson?.[s.id];
                        if (!l) return '—';
                        return (<>
                          {l.surah}{l.ayah && <> <Num>{toArabicDigits(l.ayah)}</Num></>}
                        </>);
                      })()}
                    </td>
                    {/* اختبار الجمعية بتاريخه، ثم أجزاؤه ونتيجته. والراسب
                        يُعلَّم ✗ ولا يُظلَّل. */}
                    <td className={`${PCELL} whitespace-nowrap`}>
                      {assoc
                        ? <Num>{toArabicDigits(formatDate(assoc.takenOn))}</Num>
                        : '—'}
                    </td>
                    <td className={`${PCELL} whitespace-nowrap`}>
                      {!assoc ? '' : (
                        <span className={cx('font-bold', assocPassed ? 'text-ok-700' : 'text-risk-700')}>
                          {assocPassed ? '✓' : '✗'}
                          {assoc.ajza != null && <> <Num>{toArabicDigits(assoc.ajza)}</Num></>}
                        </span>
                      )}
                    </td>
                    {/* وآخر اختبار من أيّ نوع: اسمه وتاريخه، والمستوى الذي
                        جلس له عليه — لا مستواه اليوم، فقد تقدّم منذ ذلك. */}
                    <td className={`${PCELL} whitespace-nowrap`}>
                      {last
                        ? <>{EXAM_TYPE_SHORT_AR[last.type as ExamType] ?? last.type}{' '}
                            <Num className="text-ink-500">{toArabicDigits(formatDate(last.takenOn))}</Num></>
                        : '—'}
                    </td>
                    <td className={PCELL}>
                      {last?.level != null ? <Num>{toArabicDigits(last.level)}</Num> : ''}
                    </td>
                    <td className={PCELL}>
                      {!last || last.score == null ? '' : (
                        <span className={cx('font-medium',
                          last.passed === true ? 'text-ok-700'
                            : last.passed === false ? 'text-risk-700' : 'text-ink-800')}>
                          <Num>{toArabicDigits(last.score)}</Num>
                        </span>
                      )}
                    </td>
                    {/* ما كتبه المختبِر، إن كتب. وتُترك فارغة لا بشرطة: الشرطة
                        في عمود ملاحظات تُقرأ ملاحظةً. */}
                    <td className={`${PCELL} text-start`}>{last?.note || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <PrintFoot>
          الصف المظلَّل مع ✓: اجتاز اختبار الجمعية، والرقم بعده عدد أجزائه. و✗: اختُبر ولم يجتز
          {(passed > 0 || failed > 0) && (
            <> — اجتاز <Num>{toArabicDigits(passed)}</Num> من <Num>{toArabicDigits(rows.length)}</Num>
              {failed > 0 && <>، ولم يجتز <Num>{toArabicDigits(failed)}</Num></>}</>
          )}.
          العلامة تبقى مقروءة في النسخ الرمادي.
        </PrintFoot>
      </div>
    </>
  );
}
