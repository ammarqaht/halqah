'use client';
/* ورقة خطة الحفظ — SPEC.md §6.7, approved PDF §9 (إد-٥-أ).

   Header: level · track · daily amount · student · teacher · date · both logos.
   Table:  **one row per working day** — مراجعة كبرى ثم درجتها، مراجعة صغرى ثم
           درجتها، الدرس ثم درجته، ثم الملاحظات. The client's file kept three
           lines per day and ran to three printed pages; he approved this merged
           layout on 1 Sep 2026 so the sheet prints on ONE page, with the
           «الدرجة من ١٠ لكل مقرّر» rule kept — each of the three has its own
           score box, beside it.
   Days 12 and 24 carry the two badges **with a date box and no recitation
   range**, exactly as the client's own file does.
   Footer: the printed tajweed reference (§5.4). No signature lines.

   Printing is also what records the issue date — the screen calls
   `store.markPrinted` when it opens this route, because §9 is explicit that
   «الحفظ يقع تلقائيًا مع الطباعة — لا تحتاج زر حفظ منفصلًا». */
import { Fragment, Suspense, use, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits } from '@/components/Num';
import { Btn } from '@/components/ui';
import { store, useDB } from '@/lib/store';
import {
  resolvePlan, dailyAmountFor, DEFAULT_DAY_COUNT, DEFAULT_EXAM_DAYS,
  TAJWEED_FOOTER, type PlanRow,
} from '@/lib/curriculum';
import { PLAN_KIND_AR, TRACK_AR, type StudentPlan, type Track } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

const BADGE_AR = { BADGE_GOLDEN: 'الوسام الذهبي', BADGE_DIAMOND: 'الوسام الماسي' } as const;


/**
 * One مقرّر across its four columns.
 *
 * The editor saves whatever was typed — no completeness check — so a HALF
 * filled range must print as visibly incomplete rather than as ambiguous: an
 * empty slot stays empty, and «إلى سورة» repeats the surah when the range sits
 * inside one, because a blank there would read on paper as «nothing set».
 */
function RangeCells({ r, cell, bold = false }: {
  r: PlanRow | undefined; cell: string; bold?: boolean;
}) {
  const ay = (v: string | undefined) => (!v ? '' : v === 'آخر' ? v : toArabicDigits(v));
  const from = r?.fromSurah ?? '';
  const to = r?.toSurah || (from ? from : '');
  const w = bold ? 'font-medium' : '';
  return (
    <>
      <td className={`${cell} text-start ${w}`}>{from}</td>
      <td className={cell}>{ay(r?.fromAyah)}</td>
      <td className={`${cell} text-start ${w}`}>{to}</td>
      <td className={cell}>{ay(r?.toAyah)}</td>
    </>
  );
}

function PlanSheetInner({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params);
  const db = useDB();

  /* A BLANK sheet: `/print/plan/blank?track=SILVER&level=40`.
     The supervisor keeps a stack of a level's sheets on the desk and writes a
     name on one when a boy reaches it — the level's curriculum is the same for
     everyone who takes it, so nothing but the name is missing. It issues
     nothing and stamps nothing: no plan record, no printed count, and no
     student moved onto a level he was not handed. */
  const sp = useSearchParams();
  const blank = planId === 'blank';
  const bTrack = (sp.get('track') as Track | null) ?? 'SILVER';
  const bLevel = Number(sp.get('level')) || null;

  const plan: StudentPlan | null = blank
    ? (bLevel ? {
        id: 'blank', studentId: '', track: bTrack, level: bLevel,
        issuedAt: '', issuedBy: null, dayCount: DEFAULT_DAY_COUNT,
        examDays: DEFAULT_EXAM_DAYS, dailyAmount: dailyAmountFor(bTrack),
        printedCount: 0, createdAt: '',
      } : null)
    : db.plans.find((p) => p.id === planId) ?? null;

  const student = blank ? null
    : (plan ? db.students.find((s) => s.id === plan.studentId) ?? null : null);
  const halaqa = student?.halaqaId ? db.halaqat.find((h) => h.id === student.halaqaId) ?? null : null;

  const days = useMemo(
    () => (plan ? resolvePlan(plan, db.curriculum) : []),
    [plan, db.curriculum]);

  /* Opening the sheet IS the save. Guarded with a ref so React's development
     double-invoke does not count one print as two. */
  const stamped = useRef(false);
  useEffect(() => {
    if (!plan || blank || stamped.current) return;
    stamped.current = true;
    store.markPrinted(plan.id);
  }, [plan, blank]);

  if (!plan || (!blank && !student)) {
    return (
      <div className="sheet-a4 font-sans" dir="rtl">
        <p className="text-lg2 text-ink-700">لا توجد خطة بهذا الرقم.</p>
        <p className="mt-2 text-base2 text-ink-500">
          افتح الطباعة من شاشة الخطط، فالورقة تُبنى من الخطة نفسها.
          {blank && ' ولطباعة ورقة فارغة، اختر المسار والمستوى.'}
        </p>
      </div>
    );
  }

  const cell = 'border border-ink-300 px-1.5 py-1 text-center align-middle';
  /* Tighter, because seventeen columns cannot each afford six pixels a side.
     `truncate` is the guard of last resort: a surah name that still will not
     fit is clipped rather than allowed to widen its column. */
  const tcell = 'border border-ink-300 px-1 py-1 text-center align-middle truncate';

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between gap-4 px-2">
        <p className="text-panel text-ink-600">
          فتح هذه الورقة سجّل تاريخ التسليم — <Num>{formatDate(plan.issuedAt)}</Num>.
        </p>
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        {/* ── الترويسة ─────────────────────────────────────────────────── */}
        <header className="keep mb-4 flex items-center justify-between gap-4 border-b-2 border-brand-700 pb-3">
          <LogoMark height={38} white={false} />
          <div className="text-center">
            <h1 className="font-display text-h2 text-ink-900">خطة الحفظ</h1>
            <p className="mt-0.5 text-xs2 text-ink-600">
              حلقات جامع محمد العبدالكريم — الدمام، حي أُحد
            </p>
          </div>
          <LogoJamiyah height={38} />
        </header>

        <table className="keep mb-3 w-full border-collapse text-sm2">
          <tbody>
            <tr>
              <th className={`${cell} bg-page/60 font-medium`}>الطالب</th>
              <td className={`${cell} text-start`} colSpan={3}>{student?.fullName ?? ''}</td>
              <th className={`${cell} bg-page/60 font-medium`}>المعلّم</th>
              <td className={`${cell} text-start`} colSpan={2}>{halaqa?.teacher ?? (blank ? '' : '—')}</td>
            </tr>
            <tr>
              <th className={`${cell} bg-page/60 font-medium`}>المسار</th>
              <td className={cell}>{TRACK_AR[plan.track]}</td>
              <th className={`${cell} bg-page/60 font-medium`}>المستوى</th>
              <td className={cell}><Num>{toArabicDigits(plan.level)}</Num></td>
              <th className={`${cell} bg-page/60 font-medium`}>المقرَّر اليومي</th>
              <td className={cell} colSpan={2}>{plan.dailyAmount}</td>
            </tr>
            <tr>
              <th className={`${cell} bg-page/60 font-medium`}>تاريخ التسليم</th>
              <td className={cell} colSpan={2}>
                {plan.issuedAt ? <Num>{toArabicDigits(formatDate(plan.issuedAt))}</Num> : ''}
              </td>
              <th className={`${cell} bg-page/60 font-medium`}>الحلقة</th>
              <td className={cell} colSpan={3}>
                {halaqa ? shortName(halaqa.teacher) : (blank ? '' : 'بلا حلقة')}

              </td>
            </tr>
          </tbody>
        </table>

        {/* ── الجدول — صفّ واحد لكل يوم، والدرجة بجنب كل مقرّر ─────────── */}
        {/* A4 at 12mm margins leaves ~703px, and seventeen columns will not
            find their own way into that. `table-fixed` with an explicit width
            per column is what keeps this one page: the browser stops measuring
            content and honours the numbers, so a long surah name ellipsises
            instead of pushing the sheet onto a second sheet. */}
        <table className="w-full table-fixed border-collapse text-[9.5px]">
          <colgroup>
            <col style={{ width: '4.4%' }} />{/* اليوم */}
            {[0, 1, 2].map((i) => (
              <Fragment key={i}>
                <col style={{ width: '8.7%' }} />{/* من سورة */}
                <col style={{ width: '3.3%' }} />{/* آية */}
                <col style={{ width: '8.7%' }} />{/* إلى سورة */}
                <col style={{ width: '3.3%' }} />{/* آية */}
                <col style={{ width: '5.4%' }} />{/* الدرجة — written in by hand */}
              </Fragment>
            ))}
            <col style={{ width: '7.2%' }} />{/* ملاحظات */}
          </colgroup>
          {/* Two header rows: the مقرّر spans its four columns, and each names
              what goes under it. «الحديد ١-٥» in one cell was compact but not
              what the teacher reads down — he reads a column of surahs and a
              column of ayat, so they are columns. */}
          <thead>
            <tr className="bg-page/60 text-[10px] text-ink-700">
              <th className={tcell} rowSpan={2}>اليوم</th>
              {/* The order the teacher works in: today's lesson first, then
                  what it revises, then the long revision behind it. */}
              <th className={tcell} colSpan={4}>الدرس</th>
              <th className={tcell} rowSpan={2}>درجة</th>
              <th className={tcell} colSpan={4}>مراجعة صغرى</th>
              <th className={tcell} rowSpan={2}>درجة</th>
              <th className={tcell} colSpan={4}>مراجعة كبرى</th>
              <th className={tcell} rowSpan={2}>درجة</th>
              <th className={tcell} rowSpan={2}>ملاحظات</th>
            </tr>
            <tr className="bg-page/60 text-[9px] text-ink-600">
              {[0, 1, 2].map((i) => (
                <Fragment key={i}>
                  <th className={tcell}>من سورة</th>
                  <th className={tcell}>آية</th>
                  <th className={tcell}>إلى سورة</th>
                  <th className={tcell}>آية</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              if (d.examBadge) {
                /* «يظهران في الورقة بصفّهما وخانة تاريخ … لا بمقرّر حفظ» */
                return (
                  <tr key={d.dayNo} className="keep h-[26px] bg-brand-50">
                    <td className={`${tcell} font-medium`}><Num>{toArabicDigits(d.dayNo)}</Num></td>
                    {/* The badge spans everything but the last column, so the
                        date it asks for lands in the widest cell on the row
                        rather than in a scoring box too narrow to hold it. */}
                    <td className={`${tcell} font-medium text-brand-800`} colSpan={14}>
                      {BADGE_AR[d.examBadge]}
                    </td>
                    <td className={`${tcell} text-ink-500`}>التاريخ</td>
                  </tr>
                );
              }
              const byKind = (k: PlanRow['kind']) => d.rows.find((r) => r.kind === k);
              const mk = byKind('MURAJAA_KUBRA'), ms = byKind('MURAJAA_SUGHRA'), dars = byKind('DARS');
              /* One note keeps its own words; several must each name their
                 مقرّر, or a tajweed instruction lands on the wrong recitation. */
              const noted = d.rows.filter((r) => r.note);
              const notes = noted.length > 1
                ? noted.map((r) => `${PLAN_KIND_AR[r.kind]}: ${r.note}`).join(' · ')
                : (noted[0]?.note ?? '');
              return (
                <tr key={d.dayNo} className="keep h-[26px]">
                  <td className={`${tcell} font-medium`}><Num>{toArabicDigits(d.dayNo)}</Num></td>
                  <RangeCells r={dars} cell={tcell} bold />
                  <td className={tcell} />
                  <RangeCells r={ms} cell={tcell} />
                  <td className={tcell} />
                  <RangeCells r={mk} cell={tcell} />
                  <td className={tcell} />
                  <td className={`${tcell} text-start text-[8.5px]`}>
                    {/* Clamped: an unbounded note would grow the row and spill
                        the sheet onto a second page — the merge's whole point. */}
                    <span title={notes} style={{
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {notes}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── ذيل التجويد — §5.4 ───────────────────────────────────────── */}
        <section className="keep mt-4 rounded border border-ink-200 p-2.5">
          <h2 className="mb-1.5 text-center text-xs2 font-bold text-ink-800">
            مرجع التجويد — أحكام النون الساكنة والتنوين
          </h2>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            {TAJWEED_FOOTER.map((t) => (
              <p key={t.title} className="text-[10px] text-ink-700">
                <span className="font-medium text-ink-900">{t.title}:</span> {t.body}
              </p>
            ))}
          </div>
        </section>

        <p className="keep mt-3 text-center text-[9px] text-ink-500">
          الدرجة من <Num>{toArabicDigits(10)}</Num> لكل مقرّر ·
          يوما <Num>{toArabicDigits(plan.examDays.BADGE_GOLDEN)}</Num> و
          <Num>{toArabicDigits(plan.examDays.BADGE_DIAMOND)}</Num> للاختبار
        </p>
      </div>
    </>
  );
}

export default function PlanSheet(props: { params: Promise<{ planId: string }> }) {
  return <Suspense><PlanSheetInner {...props} /></Suspense>;
}
