'use client';
/* كشف الجاهزين لاختبار الجمعية — SPEC.md §6.11 (إد-٥-هـ), approved 1 Sep 2026.
   The follow-up screen's ready list as the paper actually handed to the
   association: student, **full national ID** (client decision — the
   association matches against it), halaqa, the juz he is ready on, and the
   date he passed its diamond badge. The last column is left blank on purpose —
   the association's examiner writes in it on exam day.
   `?halaqa=` narrows to one halaqa when only part of the list is going. */
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { PrintHead, PrintFoot, PCELL } from '@/components/PrintHead';
import { Num, toArabicDigits, plural } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { followUpRows, followedRows, listRows } from '@/lib/followup';
import { TRACK_AR } from '@/lib/types';
import { shortName, teacherName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

function ReadySheet() {
  const db = useDB();
  const sp = useSearchParams();
  const halaqaId = sp.get('halaqa');
  const halaqa = halaqaId ? db.halaqat.find((h) => h.id === halaqaId) ?? null : null;

  const rows = useMemo(() => {
    /* One pass over the exams: the latest PASSED diamond per (student, juz),
       so the date beside each row is the exam that made him ready. */
    const diamondOn = new Map<string, string>();
    for (const e of db.exams) {
      if (e.type !== 'BADGE_DIAMOND' || e.passed !== true || e.ajza === null) continue;
      const key = `${e.studentId}:${e.ajza}`;
      const prev = diamondOn.get(key);
      if (!prev || e.takenOn > prev) diamondOn.set(key, e.takenOn);
    }
    return listRows(followedRows(followUpRows(db)), 'ready')
      .filter((r) => (halaqaId ? r.student.halaqaId === halaqaId : true))
      .map((r) => ({ ...r, diamondOn: diamondOn.get(`${r.student.id}:${r.ready.ajza}`) ?? null }))
      .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, 'ar'));
  }, [db, halaqaId]);

  const teacherOf = (id: string | null) => teacherName(db.halaqat, id);

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead assoc title="كشف الجاهزين لاختبار الجمعية"
          sub={<>
            أتمّوا الجزء واجتازوا الوسام الماسي عليه — بانتظار موعد الجمعية
            {halaqa && <> · حلقة {shortName(halaqa.teacher)}</>}
            {rows.length > 0 && <> · {toArabicDigits(plural(rows.length, 'طالب واحد', 'طالبان', 'طلاب', 'طالبًا'))}</>}
          </>} />

        {rows.length === 0 ? (
          <p className="py-12 text-center text-lg2 text-ink-500">
            لا طالب مستوفيًا للشرطين الآن — يظهر هنا فور اجتيازه الوسام الماسي على جزء أتمّه.
          </p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-page/60 text-[10px] text-ink-700">
                {['#', 'الطالب', 'رقم الهوية', 'الحلقة', 'المسار', 'المستوى',
                  'الجزء الجاهز', 'تاريخ اجتياز الماسي', 'ملاحظات الجمعية'].map((h) => (
                  <th key={h} className={PCELL}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.student.id} className="keep h-[28px]">
                  <td className={PCELL}><Num>{toArabicDigits(i + 1)}</Num></td>
                  <td className={`${PCELL} text-start`}>{r.student.fullName}</td>
                  <td className={PCELL}>
                    {r.student.nationalId
                      ? <Num>{toArabicDigits(r.student.nationalId)}</Num> : '—'}
                  </td>
                  <td className={`${PCELL} text-start`}>{teacherOf(r.student.halaqaId)}</td>
                  <td className={PCELL}>{r.student.track ? TRACK_AR[r.student.track] : '—'}</td>
                  <td className={PCELL}>
                    {r.student.currentLevel != null
                      ? <Num>{toArabicDigits(r.student.currentLevel)}</Num> : '—'}
                  </td>
                  <td className={PCELL}>
                    {r.ready.ajza != null ? <Num>{toArabicDigits(r.ready.ajza)}</Num> : '—'}
                  </td>
                  <td className={PCELL}>
                    {r.diamondOn ? <Num>{toArabicDigits(formatDate(r.diamondOn))}</Num> : '—'}
                  </td>
                  <td className={`${PCELL} w-24`} />
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <PrintFoot>عمود الملاحظات فارغ عمدًا — يكتب فيه مختبِر الجمعية يوم الاختبار.</PrintFoot>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><ReadySheet /></Suspense>;
}
