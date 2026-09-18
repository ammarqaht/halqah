'use client';
/* فرسان الأسبوع — «في ما يُرسل ويُعلَّق» (client, 18 Sep 2026).

   «من حقّقوا كل المتطلبات اليوم لمدة أسبوع، وهي: الحضور — الثوب — التسميع كامل.»

   NOT a ranking, and that is the whole difference between this sheet and لوحة
   الشرف. That one orders balances: the same five names hang there for weeks, and
   a boy who joined last month cannot reach it however hard he works. This one
   has no first and no fifth — every name on it did everything asked of him on
   every day the halaqa met, and they are equals. Some weeks it is empty, and an
   empty week is a true thing to pin up.

   Set large, and every mark carries a shape as well as a colour: it is read from
   two metres away and photocopied in greyscale. */
import { AlertTriangle, Check, Printer, Shirt } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Btn, Empty } from '@/components/ui';
import { Num, toArabicDigits } from '@/components/Num';
import { PrintFoot } from '@/components/PrintHead';
import { useReport, type Head } from '@/components/teacher/PrintSheet';
import { formatDate } from '@/lib/dates';

type Row = {
  id: string; fullName: string; trackAr: string; level: number | null;
  met: number; of: number;
};

export default function KnightsSheet() {
  const { data, error, loading } =
    useReport<Head & { rows: Row[]; considered: number }>('KNIGHTS', '');
  const rows = data?.rows ?? [];
  const days = data?.halaqaDays ?? 0;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <header className="mb-8 flex items-center justify-between gap-4 border-b-2 border-brand-700 pb-4">
          <LogoMark height={44} white={false} />
          <div className="text-center">
            <h1 className="font-display text-d2 text-ink-900">فرسان الأسبوع</h1>
            <p className="mt-1 text-sm2 text-ink-600">
              {data ? (
                <>
                  {data.halaqa.name} — {data.halaqa.teacher}
                  {' · '}
                  <Num>{toArabicDigits(formatDate(data.from))}</Num>
                  {' — '}
                  <Num>{toArabicDigits(formatDate(data.to))}</Num>
                </>
              ) : 'من أتمّ أسبوعه كاملًا'}
            </p>
          </div>
          <LogoJamiyah height={44} />
        </header>

        {/* المعيار مطبوع على الورقة نفسها: اسم يُعلَّق بلا شرطه اسمٌ يُختلف فيه. */}
        <p className="mb-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-cap text-brand-900">
          <span className="font-bold">المعيار — في كل يوم حلقة:</span>
          <span className="flex items-center gap-1.5"><Check size={13} strokeWidth={2.6} />حاضر في وقته</span>
          <span className="flex items-center gap-1.5"><Shirt size={13} strokeWidth={2} />بثوبه</span>
          <span className="flex items-center gap-1.5"><Check size={13} strokeWidth={2.6} />سمّع الدرس والمراجعتين</span>
        </p>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-16 rounded-xl" />)}
          </div>
        ) : error ? (
          <Empty icon={AlertTriangle} title="تعذّر تحميل الكشف" body={error} />
        ) : rows.length === 0 ? (
          <Empty icon={AlertTriangle} title="لا فرسان هذا الأسبوع"
            body={days === 0
              ? 'لم يُسجَّل يوم حلقة في هذه المدة، فلا شيء يُقاس عليه.'
              : 'لم يُتمّ أحد كل أيام الأسبوع بشروطها الثلاثة. والأسبوع القادم يبدأ من جديد.'} />
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id}
                className="keep flex items-center gap-5 rounded-xl border-2 border-brand-300 bg-brand-50 px-5 py-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-brand-700 bg-white text-brand-800">
                  <Check size={26} strokeWidth={2.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-t1 text-ink-900">
                    {r.fullName}
                  </span>
                  <span className="mt-0.5 block text-cap text-ink-600">
                    {r.trackAr}
                    {r.level != null && <> · المستوى <Num>{toArabicDigits(r.level)}</Num></>}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <Num className="font-display text-d2 leading-none text-brand-800">
                    {toArabicDigits(r.met)}
                  </Num>
                  <span className="block text-cap text-ink-500">
                    من <Num>{toArabicDigits(r.of)}</Num> أيام
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <PrintFoot>
          الأيام المحسوبة هي أيام الحلقة المسجَّلة في المدة — وأيّ يوم فيه تحضير
          يُحسب يوم حلقة. والمتأخر حاضر تُحسب له نقاطه، ولا يُعدّ فارسًا
        </PrintFoot>
      </div>
    </>
  );
}
