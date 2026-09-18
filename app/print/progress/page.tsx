'use client';
/* تقدّم الحلقات — للفترة.

   «وإحصائيات الفترة تكون في التقارير» (client, 18 Sep 2026). This table used to
   sit on the supervisor's home screen under the same name as the day's
   attendance, and the two were answering different questions: the afternoon
   asks who came, the term asks how much was memorised. The afternoon stayed
   where it is opened; this is the other one, on paper, where a period is chosen
   deliberately.

   IT IS THE رتل FILE'S OWN ARITHMETIC and says so. The figures are whatever the
   last upload carried — «أوجه الحفظ» و«أوجه المراجعة» و«أيام الحضور» — summed
   per halaqa, with the per-student mean underneath because that is the only
   figure that compares a halaqa of four with one of twenty-five. The period is
   the file's, not a range picked here: nothing in the roster is dated, and a
   sheet that cannot be honest about its own window must not print one. */
import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { PrintHead, PrintFoot, PrintSec, PCELL } from '@/components/PrintHead';
import { Num, toArabicDigits } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { derive } from '@/lib/derive';
import { halaqaLabel, shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

const n2 = (v: number) => toArabicDigits(v.toFixed(2));

export default function ProgressSheet() {
  const db = useDB();
  const d = useMemo(() => derive(db), [db]);

  const rows = d.byHalaqa;
  const totals = useMemo(() => ({
    students: rows.reduce((n, h) => n + h.n, 0),
    hp: rows.reduce((n, h) => n + h.hpTotal, 0),
    rp: rows.reduce((n, h) => n + h.rpTotal, 0),
    att: rows.reduce((n, h) => n + h.attTotal, 0),
  }), [rows]);

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead title="تقدّم الحلقات"
          sub={<span>
            {db.sourceFile ? `من ملف: ${db.sourceFile}` : 'من آخر ملف رتل مرفوع'}
            {db.importedAt && <> · <Num>{toArabicDigits(formatDate(db.importedAt.slice(0, 10)))}</Num></>}
          </span>} />

        {rows.length === 0 ? (
          <p className="mt-8 text-center text-base2 text-ink-500">لا حلقات بعد.</p>
        ) : (
          <>
            <PrintSec>المجموع لكل حلقة، ومتوسّطه لكل طالب</PrintSec>
            <table className="keep w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-page/60 text-[10px] text-ink-700">
                  <th className={`${PCELL} text-start`}>الحلقة</th>
                  <th className={PCELL}>الطلاب</th>
                  <th className={PCELL}>أوجه الحفظ</th>
                  <th className={PCELL}>للطالب</th>
                  <th className={PCELL}>أوجه المراجعة</th>
                  <th className={PCELL}>للطالب</th>
                  <th className={PCELL}>أيام الحضور</th>
                  <th className={PCELL}>للطالب</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td className={`${PCELL} text-start font-medium`}>
                      {halaqaLabel(shortName(h.teacher))}
                    </td>
                    <td className={PCELL}><Num>{toArabicDigits(h.n)}</Num></td>
                    <td className={PCELL}><Num>{n2(h.hpTotal)}</Num></td>
                    <td className={`${PCELL} text-ink-600`}><Num>{n2(h.hp)}</Num></td>
                    <td className={PCELL}><Num>{n2(h.rpTotal)}</Num></td>
                    <td className={`${PCELL} text-ink-600`}><Num>{n2(h.rp)}</Num></td>
                    <td className={PCELL}><Num>{toArabicDigits(h.attTotal)}</Num></td>
                    <td className={`${PCELL} text-ink-600`}>
                      {h.att === null ? '—' : <Num>{toArabicDigits(h.att)}</Num>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-page/60 font-medium">
                  <td className={`${PCELL} text-start`}>الإجمالي</td>
                  <td className={PCELL}><Num>{toArabicDigits(totals.students)}</Num></td>
                  <td className={PCELL}><Num>{n2(totals.hp)}</Num></td>
                  <td className={`${PCELL} text-ink-600`}>
                    <Num>{totals.students ? n2(totals.hp / totals.students) : '—'}</Num>
                  </td>
                  <td className={PCELL}><Num>{n2(totals.rp)}</Num></td>
                  <td className={`${PCELL} text-ink-600`}>
                    <Num>{totals.students ? n2(totals.rp / totals.students) : '—'}</Num>
                  </td>
                  <td className={PCELL}><Num>{toArabicDigits(totals.att)}</Num></td>
                  <td className={`${PCELL} text-ink-600`}>
                    <Num>{totals.students
                      ? toArabicDigits((Math.round((totals.att / totals.students) * 10) / 10))
                      : '—'}</Num>
                  </td>
                </tr>
              </tfoot>
            </table>

            <PrintSec>المسارات في كل حلقة</PrintSec>
            <table className="keep w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-page/60 text-[10px] text-ink-700">
                  <th className={`${PCELL} text-start`}>الحلقة</th>
                  <th className={PCELL}>ذهبي</th>
                  <th className={PCELL}>فضي</th>
                  <th className={PCELL}>تلقين</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td className={`${PCELL} text-start font-medium`}>
                      {halaqaLabel(shortName(h.teacher))}
                    </td>
                    {(['ذهبي', 'فضي', 'تلقين'] as const).map((t) => (
                      <td key={t} className={PCELL}>
                        {h.tracks[t] ? <Num>{toArabicDigits(h.tracks[t])}</Num> : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <PrintFoot>
          الأرقام كما رفعها ملف رتل — «للطالب» متوسّطٌ على طلاب الحلقة، وما سواه مجموع.
        </PrintFoot>
      </div>
    </>
  );
}
