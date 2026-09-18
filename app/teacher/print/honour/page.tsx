'use client';
/* لوحة شرف الحلقة — مع-٧: «أعلى خمسة طلاب، قابلة للطباعة وتعليقها في مكان
   الحلقة».

   Five, not the supervisor's ten: his board covers a hundred and seventeen boys
   and hangs where they all pass it; this one covers twenty-five and hangs where
   they sit. It is read from two metres away, so it is set large — and the places
   carry a shape as well as a colour because it will be photocopied. */
import { AlertTriangle, Printer } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Btn, Empty } from '@/components/ui';
import { Num, toArabicDigits } from '@/components/Num';
import { PrintFoot } from '@/components/PrintHead';
import { useFetch } from '@/components/teacher/PrintSheet';
import { cx } from '@/lib/cx';

type Row = { id: string; fullName: string; balance: number; place: number };
type Payload = { honour: Row[]; talqeenOnly?: boolean };

/* One place per row, and the top three marked. A photocopy loses the wash, so
   the numeral and the border carry the rank on their own. */
const PLACE = [
  'border-warn-500 bg-warn-100',
  'border-ink-300 bg-ink-100',
  'border-brand-400 bg-brand-100',
] as const;

export default function HonourSheet() {
  const { data, error, loading } = useFetch<Payload>('/api/teacher/points');
  const rows = data?.honour ?? [];

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <header className="mb-8 flex items-center justify-between gap-4 border-b-2 border-brand-700 pb-4">
          <LogoMark height={44} white={false} />
          <div className="text-center">
            <h1 className="font-display text-d2 text-ink-900">لوحة شرف الحلقة</h1>
            <p className="mt-1 text-sm2 text-ink-600">أعلى خمسة في النقاط</p>
          </div>
          <LogoJamiyah height={44} />
        </header>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel h-16 rounded-xl" />)}
          </div>
        ) : error ? (
          <Empty icon={AlertTriangle} title="تعذّر تحميل اللوحة" body={error} />
        ) : rows.length === 0 ? (
          <Empty icon={AlertTriangle} title="لا نقاط بعد"
            body={data?.talqeenOnly
              ? 'طلاب حلقتك في مسار التلقين، وهو خارج نظام النقاط.'
              : 'لم تُسجَّل نقاط في حلقتك بعد. أول يوم تسجّله يفتح اللوحة.'} />
        ) : (
          <ol className="space-y-3">
            {rows.map((r) => (
              <li key={r.id}
                className={cx('keep flex items-center gap-5 rounded-xl border-2 px-5 py-4',
                  PLACE[r.place - 1] ?? 'border-ink-200 bg-white')}>
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-ink-300 bg-white font-display text-d2 leading-none text-ink-900">
                  <Num>{toArabicDigits(r.place)}</Num>
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-t1 text-ink-900">
                  {r.fullName}
                </span>
                <span className="shrink-0 text-end">
                  <Num className="font-display text-d2 leading-none text-brand-800">
                    {toArabicDigits(r.balance)}
                  </Num>
                  <span className="block text-cap text-ink-500">نقطة</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <PrintFoot>
          النقاط مجموع الحركات: يومية واختبارات وأكواد، ناقصًا المشتريات والخصم
        </PrintFoot>
      </div>
    </>
  );
}
