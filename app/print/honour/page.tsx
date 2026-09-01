'use client';
/* لوحة الشرف — approved PDF §8 (إد-٤-أ): «أعلى عشرة طلاب في النقاط — قابلة
   للطباعة وتعليقها في الحلقة». It is pinned to a wall and read from two metres
   away, so it is set large, and the ranks carry a shape as well as a colour
   (DESIGN.md §1.4) because it will be photocopied in greyscale. */
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { balances, earnsPoints, EMPTY_BALANCE } from '@/lib/points';
import { shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

function HonourSheet() {
  const db = useDB();
  const sp = useSearchParams();
  const halaqaId = sp.get('halaqa');
  const halaqa = halaqaId ? db.halaqat.find((h) => h.id === halaqaId) ?? null : null;

  const bal = useMemo(() => balances(db.txns), [db.txns]);
  const top = useMemo(() => db.students
    .filter(earnsPoints)
    /* Active only — the follow-up's «المتفوقون» list is «وهم أنفسهم لوحة
       الشرف», and a student who left must not hang on the wall. */
    .filter((s) => s.status === 'ACTIVE')
    .filter((s) => (halaqaId ? s.halaqaId === halaqaId : true))
    .map((s) => ({ s, b: bal.get(s.id) ?? EMPTY_BALANCE }))
    .filter((r) => r.b.balance > 0)
    .sort((a, b) => b.b.balance - a.b.balance || a.s.fullName.localeCompare(b.s.fullName, 'ar'))
    .slice(0, 10), [db.students, bal, halaqaId]);

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <header className="mb-8 flex items-center justify-between gap-4 border-b-2 border-brand-700 pb-4">
          <LogoMark height={44} white={false} />
          <div className="text-center">
            <h1 className="font-display text-d2 text-ink-900">لوحة الشرف</h1>
            <p className="mt-1 text-sm2 text-ink-600">
              {halaqa ? `حلقة ${halaqa.teacher}` : 'حلقات جامع محمد العبدالكريم — حي أُحد'}
            </p>
          </div>
          <LogoJamiyah height={44} />
        </header>

        {top.length === 0 ? (
          <p className="py-16 text-center text-lg2 text-ink-500">لا توجد أرصدة بعد.</p>
        ) : (
          <ol>
            {top.map(({ s, b }, i) => (
              <li key={s.id} className="keep flex items-center gap-5 border-b border-ink-150 py-4 last:border-0">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-h2"
                  style={i === 0
                    ? { background: '#F0EADC', color: '#7F6531', border: '2px solid #E2D6BC' }
                    : i < 3
                      ? { background: '#E4EEEB', color: '#0A403C', border: '2px solid #CFE2DF' }
                      : { background: '#EAEEE8', color: '#525C58' }}>
                  <Num>{toArabicDigits(i + 1)}</Num>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-t1 text-ink-900">{s.fullName}</span>
                  <span className="block text-xs2 text-ink-500">
                    {s.halaqaId
                      ? shortName(db.halaqat.find((h) => h.id === s.halaqaId)?.teacher ?? '')
                      : 'بلا حلقة'}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block font-display text-d2 leading-none text-brand-800">
                    <Num>{toArabicDigits(b.balance)}</Num>
                  </span>
                  <span className="block text-micro text-ink-500">نقطة</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <footer className="mt-10 flex items-center justify-between border-t border-ink-150 pt-3 text-micro text-ink-500">
          <span>بارك الله فيهم وزادهم من فضله</span>
          <span><Num>{toArabicDigits(formatDate(new Date().toISOString()))}</Num></span>
        </footer>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><HonourSheet /></Suspense>;
}
