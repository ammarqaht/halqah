'use client';
/* تقدّم الحلقات — للفترة.

   «وإحصائيات الفترة تكون في التقارير» (client, 18 Sep 2026). This table used to
   sit on the supervisor's home screen under the same name as the day's
   attendance, and the two were answering different questions: the afternoon
   asks who came, the term asks how much was memorised. The afternoon stayed
   where it is opened; this is the other one, on paper, where a period is chosen
   deliberately.

   FROM THE REGISTER, FOR THE PERIOD CHOSEN — 2 Nov 2026. It used to be the
   last رتل file's arithmetic, so «هذي الإحصائيات صايرة ثابتة ما تتغير»: no
   afternoon a teacher recorded ever moved it. Now it is the same sums the
   supervisor's home screen makes for today (/api/admin/today), over the
   window picked in التقارير: pages memorised and reviewed from the lines
   actually recited, by «حسبة الأوجه», and days attended from the register.
   Totals per halaqa, with the per-student figure beside them because that is
   the one that compares a halaqa of four with one of twenty-five. */
import { AutoPaged } from '@/components/print/Paged';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PrintHead, PrintFoot, PrintSec, PCELL } from '@/components/PrintHead';
import { Num, toArabicDigits } from '@/components/Num';
import { halaqaLabel, shortName } from '@/lib/normalise';
import { formatDate, isoDate } from '@/lib/dates';
import { useParts } from '@/lib/reportParts';
import { Suspense } from 'react';


type Row = {
  id: string; teacher: string; students: number; tracks: Record<string, number>;
  present: number; late: number; recorded: number; recited: number;
  hifzPages: number; reviewPages: number;
};
type Payload = { from: string | null; to: string | null; days: number; halaqat: Row[] };

const n2 = (v: number) => toArabicDigits(String(Math.round(v * 100) / 100));
const per = (v: number, n: number) => (n ? n2(v / n) : '—');

function ProgressSheet() {
  const show = useParts('progress');
  const sp = useSearchParams();
  /* No period chosen: the last thirty days, said in the heading. */
  const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const a = iso(sp.get('from')) ?? isoDate(new Date(Date.now() - 29 * 86_400_000));
  const b = iso(sp.get('to')) ?? isoDate(new Date());
  /* Picked backwards, read forwards. */
  const [from, to] = a <= b ? [a, b] : [b, a];
  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/admin/today?from=${from}&to=${to}`)
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) setErr(j.error ?? 'تعذّر التحميل.'); else setD(j); })
      .catch(() => setErr('تعذّر الاتصال.'));
  }, [from, to]);

  /* A halaqa with nobody in it says nothing about progress. */
  const rows = useMemo(() => (d?.halaqat ?? []).filter((h) => h.students > 0)
    .sort((a, b) => b.students - a.students), [d]);
  const totals = useMemo(() => ({
    students: rows.reduce((n, h) => n + h.students, 0),
    hp: rows.reduce((n, h) => n + h.hifzPages, 0),
    rp: rows.reduce((n, h) => n + h.reviewPages, 0),
    att: rows.reduce((n, h) => n + h.present + h.late, 0),
  }), [rows]);

  return (
    <>
      <AutoPaged title="تقدّم الحلقات">
        <PrintHead title="تقدّم الحلقات"
          sub={<span>
            من <Num>{toArabicDigits(formatDate(from))}</Num> إلى <Num>{toArabicDigits(formatDate(to))}</Num>
            {d && <> · <Num>{toArabicDigits(d.days)}</Num> يوم حلقة سُجِّل</>}
            {' '}· من تسجيل المعلمين
          </span>} />

        {err ? (
          <p className="mt-8 text-center text-base2 text-risk-700">{err}</p>
        ) : !d ? (
          <p className="mt-8 text-center text-base2 text-ink-500">يُحسب…</p>
        ) : rows.length === 0 ? (
          <p className="mt-8 text-center text-base2 text-ink-500">لا حلقات بعد.</p>
        ) : d.days === 0 ? (
          <p className="mt-8 text-center text-base2 text-ink-500">لا تسجيل للمعلمين في هذه الفترة.</p>
        ) : (
          <>
            {show('totals') && <>
            <PrintSec>المجموع لكل حلقة، ونصيب الطالب منه</PrintSec>
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
                {rows.map((h) => {
                  const att = h.present + h.late;
                  return (
                    <tr key={h.id}>
                      <td className={`${PCELL} text-start font-medium`}>{halaqaLabel(shortName(h.teacher))}</td>
                      <td className={PCELL}><Num>{toArabicDigits(h.students)}</Num></td>
                      <td className={PCELL}><Num>{n2(h.hifzPages)}</Num></td>
                      <td className={`${PCELL} text-ink-600`}><Num>{per(h.hifzPages, h.students)}</Num></td>
                      <td className={PCELL}><Num>{n2(h.reviewPages)}</Num></td>
                      <td className={`${PCELL} text-ink-600`}><Num>{per(h.reviewPages, h.students)}</Num></td>
                      <td className={PCELL}><Num>{toArabicDigits(att)}</Num></td>
                      <td className={`${PCELL} text-ink-600`}><Num>{per(att, h.students)}</Num></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-page/60 font-medium">
                  <td className={`${PCELL} text-start`}>الإجمالي</td>
                  <td className={PCELL}><Num>{toArabicDigits(totals.students)}</Num></td>
                  <td className={PCELL}><Num>{n2(totals.hp)}</Num></td>
                  <td className={`${PCELL} text-ink-600`}><Num>{per(totals.hp, totals.students)}</Num></td>
                  <td className={PCELL}><Num>{n2(totals.rp)}</Num></td>
                  <td className={`${PCELL} text-ink-600`}><Num>{per(totals.rp, totals.students)}</Num></td>
                  <td className={PCELL}><Num>{toArabicDigits(totals.att)}</Num></td>
                  <td className={`${PCELL} text-ink-600`}><Num>{per(totals.att, totals.students)}</Num></td>
                </tr>
              </tfoot>
            </table>
            </>}

            {show('tracks') && <>
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
                    <td className={`${PCELL} text-start font-medium`}>{halaqaLabel(shortName(h.teacher))}</td>
                    {(['GOLDEN', 'SILVER', 'TALQEEN'] as const).map((t) => (
                      <td key={t} className={PCELL}>
                        {h.tracks[t] ? <Num>{toArabicDigits(h.tracks[t])}</Num> : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </>}
          </>
        )}

        <PrintFoot>أوجه الحفظ والمراجعة محسوبة مما سمّعه الطالب فعلًا في الفترة، بحسبة مسارات الحفظ.</PrintFoot>
      </AutoPaged>
    </>
  );
}

export default function Page() { return <Suspense><ProgressSheet /></Suspense>; }
