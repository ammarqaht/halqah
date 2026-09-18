'use client';
/* كشف التسميع الناقص — §١٤: «من تكرّر انتقاله بلا مراجعة، ليعالجه المعلم قبل أن
   يتراكم».

   Which line was missed is the whole value of the sheet — a boy skipping م.ك
   every time is a different problem from one who misses whichever came last — so
   the days column names them rather than counting them. */
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PrintSheet, useReport, type Head } from '@/components/teacher/PrintSheet';
import { Num, toArabicDigits } from '@/components/Num';
import { PCELL, PCELL_TIGHT } from '@/components/PrintHead';
import { formatDate } from '@/lib/dates';

type Row = {
  id: string; fullName: string; times: number;
  days: { day: string; assignmentNo: number | null; missing: string[] }[];
};

function Sheet() {
  const sp = useSearchParams();
  const search = `from=${sp.get('from') ?? ''}&to=${sp.get('to') ?? ''}`;
  const { data, error, loading } = useReport<Head & { rows: Row[] }>('INCOMPLETE', search);
  const rows = data?.rows ?? [];

  return (
    <PrintSheet title="كشف التسميع الناقص" head={data ?? null} periodic
      error={error} loading={loading}
      empty={!loading && !error && rows.length === 0}
      emptyBody="لا يوم ناقص في المدة المختارة — كل من سمّع درسه سمّع مراجعته معه."
      foot={<>عدد الطلاب: <Num>{toArabicDigits(rows.length)}</Num></>}>
      <table className="w-full border-collapse text-cap">
        <thead>
          <tr className="bg-brand-50">
            <th className={PCELL}>#</th>
            <th className={`${PCELL} text-start`}>الطالب</th>
            <th className={PCELL}>المرات</th>
            <th className={`${PCELL} text-start`}>الأيام وما نقص فيها</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className={PCELL_TIGHT}><Num>{toArabicDigits(i + 1)}</Num></td>
              <td className={`${PCELL_TIGHT} text-start`}>{r.fullName}</td>
              <td className={`${PCELL_TIGHT} font-bold`}>
                <Num>{toArabicDigits(r.times)}</Num>
              </td>
              <td className={`${PCELL_TIGHT} text-start leading-relaxed`}>
                {r.days.map((d, n) => (
                  <span key={d.day}>
                    {n > 0 && ' · '}
                    <Num>{toArabicDigits(formatDate(d.day))}</Num>
                    {d.assignmentNo != null && (
                      <> (م<Num>{toArabicDigits(d.assignmentNo)}</Num>)</>
                    )}
                    {d.missing.length > 0 && <> — {d.missing.join(' و')}</>}
                  </span>
                ))}
                {r.times > r.days.length && (
                  <> … و<Num>{toArabicDigits(r.times - r.days.length)}</Num> غيرها</>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-micro leading-relaxed text-ink-600">
        «الناقص» يومٌ سمّع فيه الطالب درسه دون مراجعته (أو دون بعضها). وينتقل إلى
        مقرّره التالي لأن الدرس أُنجز، ويُعلَّم يومه ناقصًا — فالنقص متابعة لا عقوبة،
        ولا تُخصم عليه نقطة.
      </p>
    </PrintSheet>
  );
}

export default function IncompleteSheet() {
  return <Suspense><Sheet /></Suspense>;
}
