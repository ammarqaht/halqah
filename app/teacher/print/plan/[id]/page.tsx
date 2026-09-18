'use client';
/* خطة الطالب — مع-٥: «طباعتها بالشكل نفسه الذي تطبعونه اليوم، بترويسته ومرجع
   التجويد في ذيله، في صفحة واحدة».

   Same sheet the supervisor prints, with one addition only this portal can make:
   «وتمييز مقرّر الطالب الحالي في الجدول، ليعرف المعلم أين هو وما بقي عليه». The
   pointer did not exist before the teacher's portal, so the supervisor's copy of
   this sheet has never been able to show it.

   Issuing and editing stay with the supervisor — «الإصدار يبقى عندكم كما هو» —
   and nothing on this page writes. */
import { useParams } from 'next/navigation';
import { AlertTriangle, Printer } from 'lucide-react';
import { Btn, Empty } from '@/components/ui';
import { Num, toArabicDigits } from '@/components/Num';
import { PrintHead, PrintFoot, PCELL, PCELL_TIGHT } from '@/components/PrintHead';
import { useFetch } from '@/components/teacher/PrintSheet';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Row = {
  dayNo: number; kind: 'DARS' | 'MURAJAA_SUGHRA' | 'MURAJAA_KUBRA';
  fromSurah: string; fromAyah: string; toSurah: string; toAyah: string; note: string;
};
type Day = {
  dayNo: number;
  examBadge: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
  association: boolean;
  rows: Row[];
};
type Payload = {
  student: { id: string; fullName: string; trackAr?: string; grade?: string | null; stage?: string | null };
  plan: {
    level: number; ajza: number | null; issuedAt: string; dayCount: number;
    examDays: { BADGE_GOLDEN: number; BADGE_DIAMOND: number }; dailyAmount: string;
  } | null;
  reason?: 'TALQEEN' | 'NO_PLAN';
  currentAssignment: number | null;
  awaitingExam: string | null;
  kindAr: Record<string, string>;
  days: Day[];
  tajweed: readonly { title: string; body: string }[];
};

const KINDS = ['MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS'] as const;

export default function PlanSheet() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useFetch<Payload>(`/api/teacher/students/${id}/plan`);

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead title="خطة الحفظ"
          sub={data ? (
            <>
              {data.student.fullName}
              {data.plan && (
                <>
                  {' — '}المستوى <Num>{toArabicDigits(data.plan.level)}</Num>
                  {data.plan.ajza != null && (
                    <> · <Num>{toArabicDigits(data.plan.ajza)}</Num> جزءًا</>
                  )}
                  {data.plan.dailyAmount && <> · {data.plan.dailyAmount} يوميًا</>}
                </>
              )}
            </>
          ) : undefined} />

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skel h-7 rounded" />)}
          </div>
        ) : error ? (
          <Empty icon={AlertTriangle} title="تعذّر تحميل الخطة" body={error} />
        ) : !data?.plan ? (
          <Empty icon={AlertTriangle}
            title={data?.reason === 'TALQEEN' ? 'مسار التلقين بلا خطة' : 'لم تُصدر خطته بعد'}
            body={data?.reason === 'TALQEEN'
              ? 'مسار التلقين تصنيف لا منهج له — تُتابع اختباراته وحضوره وحدها.'
              : 'راجع مشرف الحلقات ليُصدر خطة مستواه ويسلّمها.'} />
        ) : (
          <>
            {data.currentAssignment != null && (
              <p className="keep mb-2 rounded border border-brand-300 bg-brand-50 px-2 py-1 text-cap text-brand-900">
                مقرّره الحالي: <Num className="font-bold">{toArabicDigits(data.currentAssignment)}</Num>
                {' '}من <Num>{toArabicDigits(data.plan.dayCount)}</Num>
                {data.awaitingExam && ' — وهو موقوف حتى يُختبر عند المشرف'}
              </p>
            )}

            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="bg-brand-50">
                  <th className={PCELL}>المقرّر</th>
                  {KINDS.map((k) => (
                    <th key={k} className={PCELL}>{data.kindAr[k] ?? k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => {
                  const here = d.dayNo === data.currentAssignment;
                  return (
                    <tr key={d.dayNo}
                      className={cx(here && 'bg-brand-100', d.examBadge && !here && 'bg-warn-100')}>
                      <td className={cx(PCELL_TIGHT, 'font-bold')}>
                        {/* A shape as well as a wash: the sheet is photocopied,
                            and «أين أنا» must survive greyscale. */}
                        {here && <span aria-hidden className="me-0.5">◀</span>}
                        <Num>{toArabicDigits(d.dayNo)}</Num>
                      </td>

                      {d.examBadge ? (
                        <td className={cx(PCELL_TIGHT, 'font-medium')} colSpan={3}>
                          {d.examBadge === 'BADGE_GOLDEN' ? 'اختبار الوسام الذهبي'
                                                          : 'اختبار الوسام الماسي'}
                          {d.association && ' — ومعه اختبار الجمعية'}
                          <span className="ms-2 font-normal text-ink-500">التاريخ: ــــــــ</span>
                        </td>
                      ) : (
                        KINDS.map((k) => {
                          const r = d.rows.find((x) => x.kind === k);
                          const has = r && String(r.fromSurah ?? '').trim();
                          return (
                            <td key={k} className={cx(PCELL_TIGHT, 'text-[10px] leading-tight')}>
                              {has ? (
                                <>
                                  {r!.fromSurah} <Num>{toArabicDigits(r!.fromAyah)}</Num>
                                  {' ← '}
                                  {r!.toSurah} <Num>{toArabicDigits(r!.toAyah)}</Num>
                                </>
                              ) : '—'}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* مرجع التجويد — «في ذيله»، يقرأه الطالب وهو ينتظر دوره */}
            <section className="keep mt-3 rounded border border-ink-200 px-2 py-1.5">
              <h2 className="mb-1 text-cap font-bold text-ink-900">مرجع التجويد</h2>
              <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] text-ink-700">
                {data.tajweed.map((t) => (
                  <p key={t.title}>
                    <span className="font-medium text-ink-900">{t.title}:</span> {t.body}
                  </p>
                ))}
              </div>
            </section>
          </>
        )}

        <PrintFoot>
          {data?.plan?.issuedAt && (
            <>سُلِّمت في <Num>{toArabicDigits(formatDate(data.plan.issuedAt))}</Num></>
          )}
        </PrintFoot>
      </div>
    </>
  );
}
