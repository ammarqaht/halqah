'use client';
/* الورقة الأسبوعية — §١٤: «الورقة الحالية بأعمدتها، للاحتياط عند تعطّل الجوال،
   وما يُملأ فيها يُدخل بعدُ في صفحة اليوم».

   The paper the portal replaces, kept printable on purpose. «تُستبدل بصفحة اليوم
   — وتبقى قابلة للطباعة لمن أراد الورق وعند تعطّل الجوال» (§٤).

   So the columns are EMPTY. That is the point: a teacher whose phone died fills
   this in by pen and types it into وضع «يوم سابق» afterwards, which is exactly
   what that mode exists for. Its date columns are the halaqa's own days, so a
   Friday never gets a column to be marked absent in. */
import { Fragment, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PrintSheet, useReport, type Head } from '@/components/teacher/PrintSheet';
import { Num, toArabicDigits } from '@/components/Num';
import { PCELL, PCELL_TIGHT } from '@/components/PrintHead';
import { WEEKDAY_AR } from '@/lib/teacher';
import { asDate } from '@/lib/dates';

type Row = {
  id: string; fullName: string; trackAr: string;
  level: number | null; assignmentNo: number | null;
};

/* The three recitation lines, in the order the sheet prints them. */
const LINES = ['م.ك', 'م.ص', 'درس'] as const;

function Sheet() {
  const sp = useSearchParams();
  const search = `from=${sp.get('from') ?? ''}&to=${sp.get('to') ?? ''}`;
  const { data, error, loading } =
    useReport<Head & { rows: Row[]; days?: string[] }>('WEEKLY', search);
  const rows = data?.rows ?? [];
  const days = data?.days ?? [];

  return (
    <>
      {/* The page box belongs to the document, and this route is the whole
          document — so the orientation is declared here rather than globally. */}
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
    <PrintSheet title="الورقة الأسبوعية" head={data ?? null} periodic landscape
      error={error} loading={loading}
      empty={!loading && !error && rows.length === 0}
      emptyBody="لا طلاب في حلقتك بعد."
      foot={<>
        عدد الطلاب: <Num>{toArabicDigits(rows.length)}</Num>
        {' · '}تُملأ بالقلم عند تعطّل الجوال، ثم تُدخل في وضع «يوم سابق»
      </>}>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-brand-50">
            <th className={PCELL} rowSpan={2}>#</th>
            <th className={`${PCELL} text-start`} rowSpan={2}>الطالب</th>
            <th className={PCELL} rowSpan={2}>المستوى</th>
            <th className={PCELL} rowSpan={2}>المقرّر</th>
            {days.map((d) => {
              const dt = asDate(d);
              return (
                <th key={d} className={PCELL} colSpan={5}>
                  {dt ? WEEKDAY_AR[dt.getDay()] : ''}
                  <span className="block font-normal">
                    <Num>{toArabicDigits(d.slice(5))}</Num>
                  </span>
                </th>
              );
            })}
          </tr>
          <tr className="bg-brand-50">
            {days.map((d) => (
              <Fragment key={d}>
                <th className={PCELL}>ح</th>
                <th className={PCELL}>ث</th>
                {LINES.map((l) => <th key={l} className={PCELL}>{l}</th>)}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className={PCELL_TIGHT}><Num>{toArabicDigits(i + 1)}</Num></td>
              <td className={`${PCELL_TIGHT} whitespace-nowrap text-start`}>{r.fullName}</td>
              <td className={PCELL_TIGHT}>
                {r.level != null ? <Num>{toArabicDigits(r.level)}</Num> : '—'}
              </td>
              <td className={PCELL_TIGHT}>
                {r.assignmentNo != null ? <Num>{toArabicDigits(r.assignmentNo)}</Num> : '—'}
              </td>
              {/* Empty by design — this is paper to be written on. */}
              {days.map((d) => (
                <Fragment key={d}>
                  <td className={`${PCELL_TIGHT} h-6 w-5`} />
                  <td className={`${PCELL_TIGHT} w-5`} />
                  {LINES.map((l) => <td key={l} className={`${PCELL_TIGHT} w-5`} />)}
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-micro leading-relaxed text-ink-600">
        ح = الحضور · ث = الثوب · م.ك = المراجعة الكبرى · م.ص = المراجعة الصغرى ·
        درس = الحفظ الجديد. أعمدة التواريخ هي أيام حلقتك وحدها.
      </p>
    </PrintSheet>
    </>
  );
}

export default function WeeklySheet() {
  return <Suspense><Sheet /></Suspense>;
}
