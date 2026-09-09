'use client';
/* ورقة حسابات حلقة — what the teacher receives.
   One slip per boy, cut along the dotted rules, so a nine year old is handed
   his own line and not a list of everyone else's. Confidential by nature: this
   page sits under the ADMIN matcher, never the student one.

   The PINs cannot be printed from here — they exist in plaintext only at the
   moment they are generated. This sheet carries the usernames and a blank to
   write the PIN into, which is how it actually gets handed over. */
import { use, useMemo } from 'react';
import { Printer, Scissors } from 'lucide-react';
import { PrintHead, PrintFoot } from '@/components/PrintHead';
import { Num, toArabicDigits } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { halaqaLabel, shortName } from '@/lib/normalise';
import { MOSQUE, NEIGHBOURHOOD } from '@/content/student';

export default function CredentialSheet({ params }: { params: Promise<{ halaqaId: string }> }) {
  const { halaqaId } = use(params);
  const db = useDB();

  const halaqa = db.halaqat.find((h) => h.id === halaqaId) ?? null;
  const rows = useMemo(
    () => db.students
      .filter((s) => s.halaqaId === halaqaId && s.status === 'ACTIVE')
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')),
    [db.students, halaqaId]);

  if (!halaqa) {
    return (
      <div className="sheet-a4 font-sans" dir="rtl">
        <p className="text-lg2 text-ink-700">لا توجد حلقة بهذا الرقم.</p>
      </div>
    );
  }

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between gap-4 px-2">
        <p className="text-panel text-ink-600">
          ورقة سرّية — تُسلَّم للمعلّم وحده، ويُكتب رمز كل طالب في خانته.
        </p>
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead title="حسابات الطلاب"
          sub={<span>{halaqaLabel(halaqa.name || halaqa.teacher)} — {MOSQUE}، {NEIGHBOURHOOD}</span>} />

        <p className="keep mb-4 rounded-lg border border-ink-300 px-4 py-3 text-[11px] leading-relaxed text-ink-700">
          يدخل الطالب من <span className="font-medium">بوابة الطالب</span> باسم دخوله ورمزه.
          الرمز خمسة أرقام، ويُطلب منه تغييره في أول دخول. مَن نسي رمزه يراجعك، وتعيد
          تعيينه من شاشة «حسابات الطلاب».
        </p>

        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-page/60 text-[10px] text-ink-700">
              {['#', 'الطالب', 'اسم الدخول (رقم الهوية)', 'الرمز'].map((h) => (
                <th key={h} className="border border-ink-300 px-2 py-1.5 text-center align-middle">{h}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.id} className="keep h-[30px]">
                <td className="border border-ink-300 px-2 py-1.5 text-center">
                  <Num>{toArabicDigits(i + 1)}</Num>
                </td>
                <td className="border border-ink-300 px-2 py-1.5 text-start">{s.fullName}</td>
                <td className="border border-ink-300 px-2 py-1.5 text-center">
                  {s.nationalId ? <Num>{toArabicDigits(s.nationalId)}</Num>
                    : <span className="text-risk-700">بلا رقم هوية</span>}
                </td>
                {/* Written in by hand from the generation screen — never printed. */}
                <td className="border border-ink-300 px-2 py-1.5" />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="keep mt-4 flex items-center gap-2 text-[10px] text-ink-500">
          <Scissors size={12} />
          <span className="flex-1 border-t border-dashed border-ink-300" />
          <span>تُقصّ القسائم ويُعطى كل طالب قسيمته</span>
        </div>

        <PrintFoot>
          {`${halaqaLabel(shortName(halaqa.teacher))} · ${rows.length} طالبًا`}
        </PrintFoot>
      </div>
    </>
  );
}
