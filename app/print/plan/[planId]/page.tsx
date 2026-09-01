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
import { use, useEffect, useMemo, useRef } from 'react';
import { Printer } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits } from '@/components/Num';
import { Btn } from '@/components/ui';
import { store, useDB } from '@/lib/store';
import { resolvePlan, TAJWEED_FOOTER, type PlanRow } from '@/lib/curriculum';
import { PLAN_KIND_AR, TRACK_AR } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

const BADGE_AR = { BADGE_GOLDEN: 'الوسام الذهبي', BADGE_DIAMOND: 'الوسام الماسي' } as const;

/**
 * «الملك ١–١٥» عند سورة واحدة، و«الجن ١٤ ← المزمل ١٩» عند سورتين.
 *
 * The editor saves whatever the supervisor typed — no completeness check — so
 * a HALF-filled range must print as visibly incomplete, never as ambiguous: a
 * missing side gets a «—» in its slot («الملك —–١٩», «— ← المزمل ١٩») instead
 * of collapsing into text a teacher could misread as a complete range.
 */
function rangeText(r: PlanRow | undefined): string {
  if (!r || (!r.fromSurah && !r.toSurah)) return '';
  const ay = (v: string) => (!v || v === 'آخر' ? v : toArabicDigits(v));
  const fa = ay(r.fromAyah), ta = ay(r.toAyah);
  if (!r.fromSurah) return `— ← ${r.toSurah}${ta ? ` ${ta}` : ''}`;
  if (r.fromSurah === r.toSurah || !r.toSurah) {
    const span = !fa && !ta ? '' : `${fa || '—'}–${ta || '—'}`;
    /* Both ayahs empty ⇒ the whole surah; an end ayah alone must not read as
       a start ayah, so the missing side stays visible. */
    return span ? `${r.fromSurah} ${span}` : r.fromSurah;
  }
  return `${r.fromSurah} ${fa || '—'} ← ${r.toSurah} ${ta || '—'}`;
}

export default function PlanSheet({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params);
  const db = useDB();

  const plan = db.plans.find((p) => p.id === planId) ?? null;
  const student = plan ? db.students.find((s) => s.id === plan.studentId) ?? null : null;
  const halaqa = student?.halaqaId ? db.halaqat.find((h) => h.id === student.halaqaId) ?? null : null;

  const days = useMemo(
    () => (plan ? resolvePlan(plan, db.curriculum, db.planOverrides) : []),
    [plan, db.curriculum, db.planOverrides]);

  /* Opening the sheet IS the save. Guarded with a ref so React's development
     double-invoke does not count one print as two. */
  const stamped = useRef(false);
  useEffect(() => {
    if (!plan || stamped.current) return;
    stamped.current = true;
    store.markPrinted(plan.id);
  }, [plan]);

  if (!plan || !student) {
    return (
      <div className="sheet-a4 font-sans" dir="rtl">
        <p className="text-lg2 text-ink-700">لا توجد خطة بهذا الرقم.</p>
        <p className="mt-2 text-base2 text-ink-500">
          افتح الطباعة من شاشة الخطط، فالورقة تُبنى من الخطة نفسها.
        </p>
      </div>
    );
  }

  const cell = 'border border-ink-300 px-1.5 py-1 text-center align-middle';

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
              <td className={`${cell} text-start`} colSpan={3}>{student.fullName}</td>
              <th className={`${cell} bg-page/60 font-medium`}>المعلّم</th>
              <td className={`${cell} text-start`} colSpan={2}>{halaqa?.teacher ?? '—'}</td>
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
                <Num>{toArabicDigits(formatDate(plan.issuedAt))}</Num>
              </td>
              <th className={`${cell} bg-page/60 font-medium`}>الحلقة</th>
              <td className={cell} colSpan={3}>
                {halaqa ? shortName(halaqa.teacher) : 'بلا حلقة'}
                {halaqa?.timeSlot ? ` · ${halaqa.timeSlot}` : ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── الجدول — صفّ واحد لكل يوم، والدرجة بجنب كل مقرّر ─────────── */}
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-page/60 text-[10px] text-ink-700">
              <th className={`${cell} w-8`}>اليوم</th>
              <th className={cell}>مراجعة كبرى</th>
              <th className={`${cell} w-10`}>الدرجة</th>
              <th className={cell}>مراجعة صغرى</th>
              <th className={`${cell} w-10`}>الدرجة</th>
              <th className={cell}>الدرس</th>
              <th className={`${cell} w-10`}>الدرجة</th>
              <th className={`${cell} w-24`}>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              if (d.examBadge) {
                /* «يظهران في الورقة بصفّهما وخانة تاريخ … لا بمقرّر حفظ» */
                return (
                  <tr key={d.dayNo} className="keep h-[26px] bg-brand-50">
                    <td className={`${cell} font-medium`}><Num>{toArabicDigits(d.dayNo)}</Num></td>
                    <td className={`${cell} font-medium text-brand-800`} colSpan={5}>
                      {BADGE_AR[d.examBadge]}
                    </td>
                    <td className={`${cell} text-[9px] text-ink-500`}>التاريخ</td>
                    <td className={cell} />
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
                  <td className={`${cell} font-medium`}><Num>{toArabicDigits(d.dayNo)}</Num></td>
                  <td className={`${cell} text-start`}>{rangeText(mk)}</td>
                  <td className={cell} />
                  <td className={`${cell} text-start`}>{rangeText(ms)}</td>
                  <td className={cell} />
                  <td className={`${cell} text-start font-medium`}>{rangeText(dars)}</td>
                  <td className={cell} />
                  <td className={`${cell} text-start text-[9.5px]`}>
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
