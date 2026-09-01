'use client';
/* قائمة نقاط الحلقة — SPEC.md §6.11 (إد-٥-هـ), layout approved 1 Sep 2026.
   One halaqa's balances, set large: pinned in the halaqa or held at the store
   desk. The figures are the same ledger every screen reads — nothing here is a
   stored number. Talqeen students are absent, not zero — §4.11 keeps them
   outside the points system entirely. */
import { use, useMemo } from 'react';
import { Printer } from 'lucide-react';
import { PrintHead, PrintFoot, PCELL } from '@/components/PrintHead';
import { Num, toArabicDigits, plural } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { balances, earnsPoints, EMPTY_BALANCE } from '@/lib/points';
import { formatDate } from '@/lib/dates';

export default function PointsSheet({ params }: { params: Promise<{ halaqaId: string }> }) {
  const { halaqaId } = use(params);
  const db = useDB();

  const halaqa = db.halaqat.find((h) => h.id === halaqaId) ?? null;
  const rows = useMemo(() => {
    const bal = balances(db.txns);
    return db.students
      .filter((s) => s.halaqaId === halaqaId && s.status === 'ACTIVE' && earnsPoints(s))
      .map((s) => ({ s, b: bal.get(s.id) ?? EMPTY_BALANCE }))
      .sort((a, b) => b.b.balance - a.b.balance
        || a.s.fullName.localeCompare(b.s.fullName, 'ar'));
  }, [db.students, db.txns, halaqaId]);

  if (!halaqa) {
    return (
      <div className="sheet-a4 font-sans" dir="rtl">
        <p className="text-lg2 text-ink-700">لا حلقة بهذا الرقم.</p>
        <p className="mt-2 text-base2 text-ink-500">افتح القائمة من شاشة التقارير.</p>
      </div>
    );
  }

  /* Both are outside the points system, but they are NOT the same thing on
     paper: التلقين by design (§13.1), a null track by a hole in the import. */
  const excluded = db.students.filter((s) => s.halaqaId === halaqaId && s.status === 'ACTIVE');
  const talqeenCount = excluded.filter((s) => s.track === 'TALQEEN').length;
  const noTrackCount = excluded.filter((s) => s.track === null).length;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead title="قائمة نقاط الحلقة"
          sub={`حلقة ${halaqa.teacher} · ${halaqa.timeSlot} — ${toArabicDigits(plural(rows.length, 'طالب واحد', 'طالبان', 'طلاب', 'طالبًا'))}`} />

        {rows.length === 0 ? (
          <p className="py-12 text-center text-lg2 text-ink-500">لا طلاب في نظام النقاط بهذه الحلقة.</p>
        ) : (
          <table className="w-full border-collapse text-sm2">
            <thead>
              <tr className="bg-page/60 text-[10px] text-ink-700">
                {['#', 'الطالب', 'الرصيد', 'آخر حركة'].map((h) => (
                  <th key={h} className={PCELL}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, b }, i) => (
                <tr key={s.id} className="keep h-[30px]">
                  <td className={`${PCELL} w-8`}><Num>{toArabicDigits(i + 1)}</Num></td>
                  <td className={`${PCELL} text-start`}>{s.fullName}</td>
                  <td className={`${PCELL} w-24`}>
                    <Num className="text-lg2 font-bold text-brand-800">{toArabicDigits(b.balance)}</Num>
                  </td>
                  <td className={`${PCELL} w-28 text-ink-500`}>
                    {b.lastAt ? <Num>{toArabicDigits(formatDate(b.lastAt))}</Num> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <PrintFoot>
          الترتيب بالرصيد نزولًا — القائمة نفسها التي تُبنى منها لوحة الشرف.
          {talqeenCount > 0 && <> طلاب التلقين ({toArabicDigits(talqeenCount)}) خارج نظام النقاط.</>}
          {noTrackCount > 0 && <> {toArabicDigits(noTrackCount)} بلا مسار مسجَّل — صحّح مسارهم ليدخلوا النظام.</>}
        </PrintFoot>
      </div>
    </>
  );
}
