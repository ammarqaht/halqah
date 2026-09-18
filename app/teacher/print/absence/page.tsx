'use client';
/* كشف الغياب — §١٤: «حضور طلاب الحلقة خلال مدة يختارها، مع مجموع الغياب لكل طالب
   — محسوبًا على أيام الحلقة وحدها لا على أيام التقويم».

   The denominator is in the head of the sheet, not implied: «X يوم حلقة» in the
   period, so a father reading «غاب ٣» knows out of what. And a column for the
   days that were never registered, because those are the teacher's own silence
   rather than the boy's absence — «يظهر في كشف حلقتك أنت غير مسجَّل، فتعرف أنت ما
   لا يُطالَب به هو». */
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PrintSheet, useReport, type Head } from '@/components/teacher/PrintSheet';
import { Num, toArabicDigits } from '@/components/Num';
import { PCELL, PCELL_TIGHT } from '@/components/PrintHead';
import { cx } from '@/lib/cx';

type Row = {
  id: string; fullName: string;
  registered: number; present: number; late: number; absent: number;
  unregistered: number; streak: number; flagged: boolean;
};

function Sheet() {
  const sp = useSearchParams();
  const search = `from=${sp.get('from') ?? ''}&to=${sp.get('to') ?? ''}`;
  const { data, error, loading } = useReport<Head & { rows: Row[] }>('ABSENCE', search);
  const rows = data?.rows ?? [];
  const flagged = rows.filter((r) => r.flagged).length;

  return (
    <PrintSheet title="كشف الغياب" head={data ?? null} periodic error={error} loading={loading}
      empty={!loading && !error && rows.length === 0}
      emptyBody="لا طلاب في حلقتك بعد."
      foot={<>
        عدد الطلاب: <Num>{toArabicDigits(rows.length)}</Num>
        {flagged > 0 && <> · بلغوا حدّ التنبيه: <Num>{toArabicDigits(flagged)}</Num></>}
      </>}>
      <table className="w-full border-collapse text-cap">
        <thead>
          <tr className="bg-brand-50">
            <th className={PCELL}>#</th>
            <th className={`${PCELL} text-start`}>الطالب</th>
            <th className={PCELL}>المسجَّل</th>
            <th className={PCELL}>حاضر</th>
            <th className={PCELL}>متأخر</th>
            <th className={PCELL}>غائب</th>
            <th className={PCELL}>متتالية</th>
            <th className={PCELL}>غير مسجَّل</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={cx(r.flagged && 'bg-risk-100')}>
              <td className={PCELL_TIGHT}><Num>{toArabicDigits(i + 1)}</Num></td>
              <td className={`${PCELL_TIGHT} text-start`}>
                {/* The shape as well as the wash — the sheet is photocopied. */}
                {r.flagged && <span aria-hidden className="me-1 font-bold">✕</span>}
                {r.fullName}
              </td>
              <td className={PCELL_TIGHT}><Num>{toArabicDigits(r.registered)}</Num></td>
              <td className={PCELL_TIGHT}><Num>{toArabicDigits(r.present)}</Num></td>
              <td className={PCELL_TIGHT}><Num>{toArabicDigits(r.late)}</Num></td>
              <td className={cx(PCELL_TIGHT, r.absent > 0 && 'font-bold')}>
                <Num>{toArabicDigits(r.absent)}</Num>
              </td>
              <td className={PCELL_TIGHT}>
                {r.streak > 0 ? <Num>{toArabicDigits(r.streak)}</Num> : '—'}
              </td>
              <td className={cx(PCELL_TIGHT, 'text-ink-500')}>
                {r.unregistered > 0 ? <Num>{toArabicDigits(r.unregistered)}</Num> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-micro leading-relaxed text-ink-600">
        «المسجَّل» أيام الحلقة التي سُجِّل فيها هذا الطالب، و«غير مسجَّل» أيام حلقة مضت
        بلا تسجيل — وهي ليست غيابًا. وأيام الإجازة لا تقطع «متتالية»
        لأنها ليست أيام حلقة أصلًا، والمتأخر حاضر فيقطعها.
      </p>
    </PrintSheet>
  );
}

export default function AbsenceSheet() {
  return <Suspense><Sheet /></Suspense>;
}
