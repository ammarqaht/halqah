'use client';
/* كشف حلقتي — §١٤: «طلابه ومستوياتهم ومقرّراتهم وآخر تسميع ونقاطهم — ورقة واحدة
   يحملها معه».

   The one report that is not sent anywhere: he folds it into his pocket. So it
   is set at print density and fits twenty-five rows on one page, which §٣ fixed
   as the number every teacher surface must carry. */
import { PrintSheet, useReport, type Head } from '@/components/teacher/PrintSheet';
import { Num, toArabicDigits } from '@/components/Num';
import { PCELL, PCELL_TIGHT } from '@/components/PrintHead';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Row = {
  id: string; fullName: string; trackAr: string;
  level: number | null; assignmentNo: number | null; assignmentOf: number;
  lastRecitedOn: string | null; balance: number | null;
  daysOnLevel: number | null; lateOnLevel: boolean;
  lastExamAr: string | null; lastExamOn: string | null; lastExamPassed: boolean | null;
};

export default function RosterSheet() {
  const { data, error, loading } = useReport<Head & { rows: Row[] }>('ROSTER', '');
  const rows = data?.rows ?? [];

  return (
    <PrintSheet title="كشف حلقتي" head={data ?? null} error={error} loading={loading}
      empty={!loading && !error && rows.length === 0}
      emptyBody="لا طلاب في حلقتك بعد."
      foot={<>
        عدد الطلاب: <Num>{toArabicDigits(rows.length)}</Num>
        {' · '}◐ تأخّر على مستواه · ● اجتاز آخر اختبار · ✕ لم يجتزه
      </>}>
      <table className="w-full border-collapse text-cap">
        <thead>
          <tr className="bg-brand-50">
            <th className={PCELL}>#</th>
            <th className={`${PCELL} text-start`}>الطالب</th>
            <th className={PCELL}>المسار</th>
            <th className={PCELL}>المستوى</th>
            <th className={PCELL}>مضى عليه</th>
            <th className={PCELL}>المقرّر</th>
            <th className={PCELL}>آخر تسميع</th>
            <th className={PCELL}>آخر اختبار</th>
            <th className={PCELL}>النقاط</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className={PCELL_TIGHT}><Num>{toArabicDigits(i + 1)}</Num></td>
              <td className={`${PCELL_TIGHT} text-start`}>{r.fullName}</td>
              <td className={PCELL_TIGHT}>{r.trackAr}</td>
              <td className={PCELL_TIGHT}>
                {r.level != null ? <Num>{toArabicDigits(r.level)}</Num> : '—'}
              </td>
              {/* «كم مضى على المستوى» — bolded past §٤.٩'s limit, and the sheet
                  survives greyscale because the mark carries it too. */}
              <td className={cx(PCELL_TIGHT, r.lateOnLevel && 'font-bold')}>
                {r.daysOnLevel != null
                  ? <>{r.lateOnLevel && <span aria-hidden>◐ </span>}
                      <Num>{toArabicDigits(r.daysOnLevel)}</Num></>
                  : '—'}
              </td>
              <td className={PCELL_TIGHT}>
                {r.assignmentNo != null
                  ? <>
                      <Num>{toArabicDigits(r.assignmentNo)}</Num>
                      {r.assignmentOf > 0 && <> / <Num>{toArabicDigits(r.assignmentOf)}</Num></>}
                    </>
                  : '—'}
              </td>
              <td className={PCELL_TIGHT}>
                {r.lastRecitedOn
                  ? <Num>{toArabicDigits(formatDate(r.lastRecitedOn))}</Num> : '—'}
              </td>
              {/* «وآخر اختبار وتاريخه» — the kind, its date, and whether he
                  passed it, in one cell so the column stays a column. */}
              <td className={PCELL_TIGHT}>
                {r.lastExamAr ? (
                  <>
                    {r.lastExamPassed === true ? '● ' : r.lastExamPassed === false ? '✕ ' : ''}
                    {r.lastExamAr}
                    {r.lastExamOn && (
                      <span className="block text-[9px] text-ink-500">
                        <Num>{toArabicDigits(formatDate(r.lastExamOn))}</Num>
                      </span>
                    )}
                  </>
                ) : '—'}
              </td>
              <td className={PCELL_TIGHT}>
                {r.balance != null ? <Num>{toArabicDigits(r.balance)}</Num> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintSheet>
  );
}
