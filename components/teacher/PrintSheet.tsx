'use client';
/* The frame every one of the teacher's printed sheets sits in — the print
   button, the A4 page, the head and the foot, and the four states.

   One component because all five list sheets differ only in their table, and
   five copies of the loading, error and empty branches is five chances for one
   of them to be missing. «شاشة بلا الحالات الأربع ليست منتهية» applies to a
   sheet as much as to a screen: a report that prints an empty table with no
   sentence on it is a report a teacher hands to a parent by mistake. */
import { useEffect, useState } from 'react';
import { AlertTriangle, Printer } from 'lucide-react';
import { Btn, Empty } from '@/components/ui';
import { Num, toArabicDigits } from '@/components/Num';
import { PrintHead, PrintFoot } from '@/components/PrintHead';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

export type Head = {
  halaqa: { name: string; teacher: string; timeSlot: string };
  from: string; to: string; today: string;
  halaqaDays: number;
};

export function PrintSheet({
  title, head, periodic, error, loading, empty, emptyBody, children, foot, landscape,
}: {
  title: string;
  head: Head | null;
  /** الورقة الأسبوعية alone — twenty-nine columns do not fit a portrait page. */
  landscape?: boolean;
  /** True when the sheet's subtitle should name the period it covers. */
  periodic?: boolean;
  error?: string;
  loading?: boolean;
  empty?: boolean;
  emptyBody?: string;
  children?: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <>
      <div className={cx('no-print mx-auto mb-4 flex max-w-full items-center justify-end px-2',
        landscape ? 'w-[1123px]' : 'w-[794px]')}>
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className={cx('sheet-a4 font-sans', landscape && 'landscape')} dir="rtl">
        <PrintHead title={title}
          sub={head ? (
            <>
              {head.halaqa.name} — {head.halaqa.teacher} · {head.halaqa.timeSlot}
              {periodic && (
                <>
                  {' · '}
                  <Num>{toArabicDigits(formatDate(head.from))}</Num>
                  {' — '}
                  <Num>{toArabicDigits(formatDate(head.to))}</Num>
                  {' · '}
                  <Num>{toArabicDigits(head.halaqaDays)}</Num> يوم حلقة
                </>
              )}
            </>
          ) : undefined} />

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel h-8 rounded" />)}
          </div>
        ) : error ? (
          <Empty icon={AlertTriangle} title="تعذّر تحميل التقرير" body={error} />
        ) : empty ? (
          <Empty icon={AlertTriangle} title="لا شيء في هذا الكشف"
            body={emptyBody ?? 'لا صفوف في المدة المختارة.'} />
        ) : children}

        <PrintFoot>{foot}</PrintFoot>
      </div>
    </>
  );
}

/** The hook every list sheet uses — one fetch, one shape, one place to change. */
export function useReport<T>(kind: string, search: string) {
  return useFetch<T>(`/api/teacher/reports?kind=${kind}${search ? `&${search}` : ''}`);
}

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    fetch(url)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) { setError(j.error ?? 'تعذّر التحميل.'); return; }
        setData(j);
      })
      .catch(() => { if (live) setError('تعذّر الاتصال.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [url]);

  return { data, error, loading };
}
