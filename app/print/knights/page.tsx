'use client';
/* فرسان الأسبوع — عند المشرف، للمسجد كله أو لحلقة واحدة.
   «ويكون فيه صفحة لطباعة أسماء الفرسان عند المشرف» (client, 18 Sep 2026).

   «من حقّقوا كل المتطلبات اليوم لمدة أسبوع، وهي: الحضور — الثوب — التسميع كامل.»

   NOT a ranking, and that is the difference between it and لوحة الشرف beside it
   in the panel: that sheet orders balances and always carries ten names whoever
   did what this week; this one carries everyone who did everything asked of him
   on every day his halaqa met — none of them on a bad week, all of them on a
   good one.

   It is the one supervisor sheet that does NOT read `useDB()`: attendance and
   recitation are the teacher portal's own tables, and they never travel through
   the supervisor's browser copy. It asks `/api/admin/knights`, which reads the
   same `lib/knights.ts` the teacher's sheet reads — one definition of a title
   children are named by. */
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Printer, Shirt } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

type Row = {
  id: string; fullName: string; halaqaId: string | null; halaqaName: string;
  trackAr: string; level: number | null; met: number; of: number;
};
type Payload = {
  from: string; to: string; rows: Row[]; halaqaDays: number; considered: number;
};

function KnightsSheet() {
  const db = useDB();
  const sp = useSearchParams();
  const halaqaId = sp.get('halaqa');
  const halaqa = halaqaId ? db.halaqat.find((h) => h.id === halaqaId) ?? null : null;

  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/admin/knights${halaqaId ? `?halaqa=${halaqaId}` : ''}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErr(j.error ?? 'تعذّر تحميل الكشف.'); return; }
        setD(j);
      })
      .catch(() => setErr('تعذّر الاتصال.'));
  }, [halaqaId]);

  const rows = d?.rows ?? [];
  /* Across the mosque the halaqa is worth naming beside each boy; inside one
     halaqa it is the title of the sheet and repeating it on every row is noise. */
  const showHalaqa = !halaqaId;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <header className="mb-6 flex items-center justify-between gap-4 border-b-2 border-brand-700 pb-4">
          <LogoMark height={44} white={false} />
          <div className="text-center">
            <h1 className="font-display text-d2 text-ink-900">فرسان الأسبوع</h1>
            <p className="mt-1 text-sm2 text-ink-600">
              {halaqa ? `حلقة ${halaqa.teacher}` : 'حلقات جامع محمد العبدالكريم — حي أُحد'}
              {d && (
                <>
                  {' · '}
                  <Num>{toArabicDigits(formatDate(d.from))}</Num>
                  {' — '}
                  <Num>{toArabicDigits(formatDate(d.to))}</Num>
                </>
              )}
            </p>
          </div>
          <LogoJamiyah height={44} />
        </header>

        <p className="mb-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-cap text-brand-900">
          <span className="font-bold">المعيار — في كل يوم حلقة:</span>
          <span className="flex items-center gap-1.5"><Check size={13} strokeWidth={2.6} />حاضر في وقته</span>
          <span className="flex items-center gap-1.5"><Shirt size={13} strokeWidth={2} />بثوبه</span>
          <span className="flex items-center gap-1.5"><Check size={13} strokeWidth={2.6} />سمّع الدرس والمراجعتين</span>
        </p>

        {err ? (
          <p className="py-16 text-center text-lg2 text-risk-700">{err}</p>
        ) : !d ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-14 rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-lg2 leading-relaxed text-ink-500">
            {d.halaqaDays === 0
              ? 'لم يُسجَّل يوم حلقة في هذه المدة، فلا شيء يُقاس عليه.'
              : 'لم يُتمّ أحد كل أيام الأسبوع بشروطها الثلاثة — والأسبوع القادم يبدأ من جديد.'}
          </p>
        ) : (
          <ul>
            {rows.map((r) => (
              <li key={r.id}
                className="keep flex items-center gap-5 border-b border-ink-150 py-3.5 last:border-0">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-brand-300 bg-brand-50 text-brand-800">
                  <Check size={21} strokeWidth={2.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-t1 text-ink-900">
                    {r.fullName}
                  </span>
                  <span className="block text-xs2 text-ink-500">
                    {showHalaqa && <>{shortName(r.halaqaName)} · </>}
                    {r.trackAr}
                    {r.level != null && <> · المستوى <Num>{toArabicDigits(r.level)}</Num></>}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block font-display text-h2 leading-none text-brand-800">
                    <Num>{toArabicDigits(r.met)}</Num>
                  </span>
                  <span className="block text-micro text-ink-500">
                    من <Num>{toArabicDigits(r.of)}</Num> أيام
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-10 flex items-center justify-between gap-4 border-t border-ink-150 pt-3 text-micro leading-relaxed text-ink-500">
          <span>
            الأيام المحسوبة هي أيام الحلقة المسجَّلة في المدة — والمتأخر حاضر تُحسب
            له نقاطه ولا يُعدّ فارسًا
          </span>
          <span className="shrink-0">
            <Num>{toArabicDigits(formatDate(new Date().toISOString()))}</Num>
          </span>
        </footer>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><KnightsSheet /></Suspense>;
}
