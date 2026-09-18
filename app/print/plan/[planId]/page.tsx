'use client';
/* ورقة خطة الحفظ — SPEC.md §6.7, approved PDF §9 (إد-٥-أ).

   Header: level · track · daily amount · student · teacher · date · both logos.
   Table:  **one row per working day** — مراجعة كبرى ثم درجتها، مراجعة صغرى ثم
           درجتها، الدرس ثم درجته، ثم الملاحظات. The client's file kept three
           lines per day and ran to three printed pages; he approved this merged
           layout on 1 Sep 2026 so the sheet prints on ONE page, with the
           «الدرجة من ١٠ لكل مقرّر» rule kept — each of the three has its own
           score box, beside it.

   EACH مقرّر IS ONE CELL, and that is a reversal. It was four — من سورة، آية،
   إلى سورة، آية — on the reasoning that a teacher reads down a column of surahs
   and a column of ayat. Seventeen columns across 703mm is what that cost, and
   at that width every name was ellipsised: «قالب الخطة الآن مب واضح وفيه أشياء
   متداخلة ومختفية. أبغى عمود من سورة والآية إلى سورة والآية في كل مقرّر تكون
   خلية وحدة، يعني ثلاث خلايا» (client, 18 Sep 2026).

   He is right, and the reason is worth keeping: a range is ONE fact. «الحديد ١
   — الحديد ١١» split across four boxes is read by reassembling it, and a sheet
   that has to be reassembled at every row is the sheet he described. Eight
   columns give each range the width to be printed whole.
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
import { Num } from '@/components/Num';
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
 * One مقرّر, whole, in one cell.
 *
 * The editor saves whatever was typed — no completeness check — so a HALF
 * filled range must print as visibly incomplete rather than as ambiguous: an
 * empty side stays empty rather than borrowing the other one's surah.
 *
 * The surah is said ONCE when both ends sit inside it: «الحديد ١ — ١١» is how
 * it is spoken, and repeating the name in the same breath is how a cell this
 * width ends up ellipsised again.
 */
function Range({ r }: { r: PlanRow | undefined }) {
  const from = r?.fromSurah ?? '';
  const to = r?.toSurah ?? '';
  const fa = r?.fromAyah ?? '';
  const ta = r?.toAyah ?? '';
  if (!from && !to && !fa && !ta) return null;

  const same = !to || to === from;
  return (
    <span className="leading-tight">
      <span className="font-medium">{from}</span>
      {fa && <> <span className="tabular-nums">{fa}</span></>}
      <span className="mx-1 text-ink-400">—</span>
      {!same && <span className="font-medium">{to} </span>}
      {ta && <span className="tabular-nums">{ta}</span>}
    </span>
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
  /* Read at arm's length on a desk, often photocopied. Darkened, because the
     printer's grey was the reason the sheet looked washed out. `align-middle`
     centres each cell vertically — the scoring boxes are taller than a line of
     text, so without it every entry sat on the ceiling of its box.

     NOTHING TRUNCATES any more. It used to, as the guard of last resort behind
     seventeen columns; at eight there is room for the whole range, and a
     clipped «المجاد…» on a sheet a child recites from was never a
     shortened name — it was a different one. A long one wraps inside its cell. */
  const tcell = 'border border-ink-400 px-1 py-1.5 text-center align-middle text-ink-900';

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
              <td className={cell}><Num>{plan.level}</Num></td>
              <th className={`${cell} bg-page/60 font-medium`}>المقرَّر اليومي</th>
              <td className={cell} colSpan={2}>{plan.dailyAmount}</td>
            </tr>
            <tr>
              <th className={`${cell} bg-page/60 font-medium`}>تاريخ التسليم</th>
              <td className={cell} colSpan={2}>
                {plan.issuedAt ? <Num>{formatDate(plan.issuedAt)}</Num> : ''}
              </td>
              <th className={`${cell} bg-page/60 font-medium`}>الحلقة</th>
              <td className={cell} colSpan={3}>
                {halaqa ? shortName(halaqa.teacher) : (blank ? '' : 'بلا حلقة')}

              </td>
            </tr>
          </tbody>
        </table>

        {/* ── الجدول — صفّ واحد لكل يوم، والدرجة بجنب كل مقرّر ─────────── */}
        {/* `table-fixed` with an explicit width per column is what keeps this
            one page: the browser stops measuring content and honours the
            numbers, so a long surah name wraps inside its cell instead of
            pushing the sheet onto a second sheet. */}
        <table className="w-full table-fixed border-collapse text-[10.5px] font-medium">
          <colgroup>
            <col style={{ width: '4.5%' }} />{/* اليوم */}
            {[0, 1, 2].map((i) => (
              <Fragment key={i}>
                <col style={{ width: '19%' }} />{/* المقرّر كاملًا في خلية */}
                <col style={{ width: '6%' }} />{/* الدرجة — تُكتب باليد */}
              </Fragment>
            ))}
            <col style={{ width: '20.5%' }} />{/* الملاحظة — أطول خلية في السطر */}
          </colgroup>
          <thead>
            <tr className="bg-page/60 text-[10px] text-ink-700">
              <th className={tcell}>اليوم</th>
              <th className={tcell}>مراجعة كبرى</th>
              <th className={tcell}>درجة</th>
              <th className={tcell}>مراجعة صغرى</th>
              <th className={tcell}>درجة</th>
              <th className={tcell}>الدرس</th>
              <th className={tcell}>درجة</th>
              <th className={tcell}>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              if (d.examBadge) {
                /* «يظهران في الورقة بصفّهما وخانة تاريخ … لا بمقرّر حفظ», and
                   since 18 Sep 2026 the row is THREE cells: «خلية الوسام تكون
                   على ٣ أعمدة: الأول اسم الوسام، والثاني التاريخ وتُكتب كلمة
                   التاريخ في نفس الخلية، والثالثة الملاحظة». The word stays in
                   the cell because the box is filled in by hand months later,
                   by whoever is holding the sheet. */
                return (
                  <tr key={d.dayNo} className="keep h-[26px] bg-brand-50">
                    <td className={`${tcell} font-medium`}><Num>{d.dayNo}</Num></td>
                    <td className={`${tcell} font-medium text-brand-800`} colSpan={3}>
                      {BADGE_AR[d.examBadge]}
                      {/* «واختبار الجمعية معه» on the levels the file marks —
                          the boy and his teacher both need to know the day
                          carries two exams, not one. */}
                      {d.association && (
                        <span className="text-assoc-700"> · اختبار الجمعية</span>
                      )}
                    </td>
                    <td className={`${tcell} text-start font-normal text-ink-500`} colSpan={2}>
                      التاريخ
                    </td>
                    <td className={`${tcell} text-start font-normal text-ink-400`} colSpan={2}>
                      ملاحظة
                    </td>
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
                  <td className={`${tcell} font-medium`}>
                    <Num>{d.dayNo}</Num>
                    {d.association && (
                      <span className="block text-[7.5px] leading-none text-assoc-700">جمعية</span>
                    )}
                  </td>
                  <td className={tcell}><Range r={mk} /></td>
                  <td className={tcell} />
                  <td className={tcell}><Range r={ms} /></td>
                  <td className={tcell} />
                  <td className={tcell}><Range r={dars} /></td>
                  <td className={tcell} />
                  <td className={`${tcell} text-start text-[8.5px] font-normal`}>
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

        {/* ── ذيل التجويد — §5.4 ─────────────────────────────────────────
            «أبي بلوك مرجع التجويد يكون أصغر لكي لا ينتقل إلى صفحة أخرى»
            (client, 18 Sep 2026). It is a reference, not a lesson: it is read
            once by whoever is unsure, and every millimetre it takes is a
            millimetre the twenty-four rows above it do not have. */}
        <section className="keep mt-2.5 rounded border border-ink-200 px-2 py-1.5">
          <h2 className="mb-1 text-center text-[9.5px] font-bold text-ink-800">
            مرجع التجويد — أحكام النون الساكنة والتنوين
          </h2>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
            {TAJWEED_FOOTER.map((t) => (
              <p key={t.title} className="text-[8.5px] leading-snug text-ink-700">
                <span className="font-medium text-ink-900">{t.title}:</span> {t.body}
              </p>
            ))}
          </div>
        </section>

        <p className="keep mt-1.5 text-center text-[8.5px] text-ink-500">
          الدرجة من <Num>{10}</Num> لكل مقرّر ·
          يوما <Num>{plan.examDays.BADGE_GOLDEN}</Num> و
          <Num>{plan.examDays.BADGE_DIAMOND}</Num> للاختبار
        </p>
      </div>
    </>
  );
}

export default function PlanSheet(props: { params: Promise<{ planId: string }> }) {
  return <Suspense><PlanSheetInner {...props} /></Suspense>;
}
