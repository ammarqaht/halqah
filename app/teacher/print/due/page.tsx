'use client';
/* المستحقون للاختبار — §١٤ و مع-٦-أ: «كشف صغير يرسله إليكم أو يعرضه على الشاشة».

   This is the one sheet a teacher sends UPWARDS, so it carries what the
   supervisor needs to act: who, which badge, which level, since when, and
   whether a date has already been booked. Nothing else. */
import { PrintSheet, useReport, type Head } from '@/components/teacher/PrintSheet';
import { Num, toArabicDigits } from '@/components/Num';
import { PCELL, PCELL_TIGHT } from '@/components/PrintHead';
import { formatDate } from '@/lib/dates';

type Row = {
  id: string; fullName: string; trackAr: string;
  level: number | null; assignmentNo: number | null;
  badge: string | null; badgeAr: string;
  dueSince: string | null; bookedOn: string | null;
};

export default function DueSheet() {
  const { data, error, loading } = useReport<Head & { rows: Row[] }>('DUE', '');
  const rows = data?.rows ?? [];
  const waiting = rows.filter((r) => !r.bookedOn).length;

  return (
    <PrintSheet title="المستحقون للاختبار" head={data ?? null} error={error} loading={loading}
      empty={!loading && !error && rows.length === 0}
      emptyBody="لا أحد من طلابك بلغ مقرّر الاختبار الآن."
      foot={<>
        المستحقون: <Num>{toArabicDigits(rows.length)}</Num>
        {waiting > 0 && <> · بلا موعد محجوز: <Num>{toArabicDigits(waiting)}</Num></>}
      </>}>
      <table className="w-full border-collapse text-cap">
        <thead>
          <tr className="bg-warn-100">
            <th className={PCELL}>#</th>
            <th className={`${PCELL} text-start`}>الطالب</th>
            <th className={PCELL}>المسار</th>
            <th className={PCELL}>المستوى</th>
            <th className={PCELL}>المقرّر</th>
            <th className={PCELL}>الوسام</th>
            <th className={PCELL}>مستحق منذ</th>
            <th className={PCELL}>الموعد المحجوز</th>
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
              <td className={PCELL_TIGHT}>
                {r.assignmentNo != null ? <Num>{toArabicDigits(r.assignmentNo)}</Num> : '—'}
              </td>
              <td className={`${PCELL_TIGHT} font-medium`}>{r.badgeAr || '—'}</td>
              <td className={PCELL_TIGHT}>
                {r.dueSince ? <Num>{toArabicDigits(formatDate(r.dueSince))}</Num> : '—'}
              </td>
              <td className={PCELL_TIGHT}>
                {r.bookedOn
                  ? <Num>{toArabicDigits(formatDate(r.bookedOn))}</Num>
                  : <span aria-hidden>▭</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-micro leading-relaxed text-ink-600">
        الطالب يبقى على مقرّره حتى تُسجَّل نتيجته، فلا يمضي في الحفظ قبل اختباره.
        والاختبار وتسجيل نتيجته عند مشرف الحلقة.
      </p>
    </PrintSheet>
  );
}
