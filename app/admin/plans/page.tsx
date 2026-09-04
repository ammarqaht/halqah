'use client';
/* الخطط — SPEC.md §6.7, approved PDF §9 (إد-٥-أ).
   «الطالب يطلب ورقة مستواه، فتطبعها في ثوانٍ ويُسجَّل التاريخ تلقائيًا».

   Four steps, in the client's own order: search by name → his halaqa, track and
   NEXT level appear by themselves → preview → print, which saves the date in
   the same action. He never types the level: «لا تُدخل المستوى بنفسك — النظام
   يعرف مستوى الطالب الحالي … فيجهّز له المستوى التالي مباشرة». It stays
   editable, because §11 keeps every decision his.

   The sheet is editable before printing too, and every edit is stored as an
   override rather than written over the curriculum — which is what makes
   «لا يُفقد الأصل أبدًا» true rather than merely promised. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileText, Printer, AlertTriangle, Inbox, UploadCloud, Pencil,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num, juzPhrase } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { resolvePlan, levelAvailable, dailyAmountFor, isCustomised, draftPlan } from '@/lib/curriculum';
import { nextLevel, ajzaForLevel } from '@/lib/exams';
import { PLAN_KIND_AR, TRACK_AR, type Track } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { formatDate, relativeDay } from '@/lib/dates';
import { cx } from '@/lib/cx';

const BADGE_AR = { BADGE_GOLDEN: 'الوسام الذهبي', BADGE_DIAMOND: 'الوسام الماسي' } as const;

function PlansScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();

  const [studentId, setStudentId] = useState(sp.get('student') ?? '');
  /* The panel narrows the list by track; «الكل» is an absent parameter. */
  const trackFilter = (sp.get('track') as Track | null) ?? null;
  const [level, setLevel] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /* Talqeen has no curriculum and no level at all — §13.1. Not offered.
     A student with NO track is not offered either, but he is counted apart:
     «لا مسار» is a gap in the file, not a decision, and lumping him in with
     talqeen would hide it. */
  const withTrack = useMemo(
    () => db.students.filter((s) => s.track && s.track !== 'TALQEEN'), [db.students]);
  const eligible = useMemo(
    () => (trackFilter ? withTrack.filter((s) => s.track === trackFilter) : withTrack),
    [withTrack, trackFilter]);
  const talqeenCount = db.students.filter((s) => s.track === 'TALQEEN').length;
  const untrackedCount = db.students.filter((s) => !s.track).length;

  const student = eligible.find((s) => s.id === studentId) ?? null;
  const halaqa = student?.halaqaId ? db.halaqat.find((h) => h.id === student.halaqaId) ?? null : null;

  /* «النظام يعرف مستوى الطالب الحالي … فيجهّز له المستوى التالي مباشرة» —
     but only if that level is one the uploaded curriculum actually holds. The
     client's «منهج الحفظ» carries silver 40–60 only, so proposing the next
     level dropped every silver student on 40 straight onto an error and no
     sheet at all. Propose the next level, fall back to the one he is on, and
     say which of the two is on screen. */
  const has = (n: number | null) => n !== null && student?.track
    && db.curriculum.some((d) => d.track === student.track && d.level === n);
  const next = student?.currentLevel != null ? nextLevel(student.currentLevel) : null;
  const suggested = has(next) ? next
    : has(student?.currentLevel ?? null) ? student!.currentLevel
    : next;
  const fellBack = suggested !== null && next !== null && suggested !== next;

  useEffect(() => {
    setLevel(suggested != null ? String(suggested) : '');
  }, [suggested, studentId]);

  const levelNum = level === '' ? null : Number(level);
  const availability = student?.track && levelNum
    ? levelAvailable(student.track, levelNum, db.curriculum) : null;

  /* The plan record exists as soon as there is something to preview; printing
     is what stamps it. Issuing is idempotent per (student, level). */
  /* Look, do not write. This called `store.issuePlan` during render, so simply
     clicking a name created a plan row and set that student's `currentLevel`
     to whichever level was on screen — a student on 23 came back 40, and the
     «طُبعت N خطة اليوم» counter climbed with every click. The stored plan is
     used when one exists; otherwise a draft is built in memory, and printing
     is what commits it. */
  const plan = useMemo(() => {
    if (!student?.track || !levelNum || !availability?.ok) return null;
    const track = student.track as Exclude<typeof student.track, null>;
    return store.planFor(student.id, track, levelNum)
      ?? draftPlan({ studentId: student.id, track, level: levelNum,
                     dailyAmount: dailyAmountFor(track) });
  }, [student, levelNum, availability?.ok, db.plans]);

  const overrides = useMemo(
    () => db.planOverrides.filter((o) => o.planId === plan?.id), [db.planOverrides, plan]);
  const days = useMemo(
    () => (plan ? resolvePlan(plan, db.curriculum, db.planOverrides) : []),
    [plan, db.curriculum, db.planOverrides]);
  const customised = plan ? isCustomised(plan, overrides) : false;

  const studentOptions = useMemo(() => eligible.map((s) => ({
    value: s.id,
    label: s.fullName,
    hint: [s.track ? TRACK_AR[s.track] : 'بلا مسار',
           s.halaqaId ? shortName(db.halaqat.find((h) => h.id === s.halaqaId)?.teacher ?? '') : 'بلا حلقة',
           s.currentLevel != null ? `المستوى ${s.currentLevel}` : 'بلا مستوى'].join(' · '),
  })).sort((a, b) => a.label.localeCompare(b.label, 'ar')), [eligible, db.halaqat]);

  /* ── empty states ───────────────────────────────────────────────────── */
  if (!db.curriculum.length) {
    return (
      <>
        <TopBar title="الخطط" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لم يُرفع منهج الحفظ بعد"
              body="ورقة المستوى تُبنى من ملف «منهج الحفظ» — مستويات المسارين كاملة. ارفعه مرة واحدة، ثم تُطبع الخطط في ثوانٍ."
              action={<Link href="/admin/plans/curriculum">
                <Btn variant="primary" size="lg" icon={UploadCloud}>رفع منهج الحفظ</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="الخطط"
        crumbs={student ? [student.fullName] : undefined}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            {plan && student && availability?.ok && (
              /* Printing is the act that commits — §9: «الحفظ يقع تلقائيًا مع
                 الطباعة». The draft on screen has no stored id, so it is issued
                 here and the print route opens on the row that now exists. */
              <Btn variant="primary" icon={Printer} onClick={() => {
                const issued = store.issuePlan({
                  studentId: student.id,
                  track: student.track as Exclude<typeof student.track, null>,
                  level: plan.level,
                  dailyAmount: plan.dailyAmount,
                });
                window.open(`/print/plan/${issued.id}`, '_blank', 'noopener');
              }}>طباعة وحفظ التاريخ</Btn>
            )}
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        {/* ── ١ · الطالب ← ٢ · مستواه التالي ───────────────────────────── */}
        <Sheet className="rise mb-4">
          <SheetHead title="الطالب ومستواه"
            meta="اختر الطالب، فتظهر حلقته ومساره ومستواه التالي من نفسها" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم الطالب"
              hint={[
                trackFilter ? `المعروض: مسار ${TRACK_AR[trackFilter]} فقط — بدّله من اللوحة` : null,
                talqeenCount > 0 ? `${talqeenCount} من طلاب التلقين خارج القائمة — لا منهج لهم ولا مستوى` : null,
                untrackedCount > 0 ? `${untrackedCount} بلا مسار في الملف` : null,
              ].filter(Boolean).join(' · ') || 'ابحث بالاسم'}>
              <Combobox value={studentId} onChange={setStudentId} options={studentOptions}
                placeholder="اختر الطالب" searchPlaceholder="ابحث بالاسم…"
                emptyText="لا طالب بهذا الاسم" />
            </Field>
            <Field label="المستوى المطلوب طباعته"
              /* The levels COUNT DOWN — 60 is the start of the silver track and
                 1 is its end (§4.2: الفضي ٥٩=جزء، ٥٧=جزآن…). Reading «40 → 39»
                 as a bug is the natural reading, so the screen says which way
                 they run instead of leaving it to be guessed. */
              hint={suggested == null
                ? 'لا مستوى محفوظ لهذا الطالب، فاكتبه'
                : fellBack
                ? `مستواه الحالي ${student?.currentLevel}، والتالي ${next} لا منهج له — فالمعروض مستواه الحالي`
                : `مستواه الحالي ${student?.currentLevel} — والتالي ${suggested}، فالمستويات تتنازل`}>
              <input className={INPUT} inputMode="numeric" value={level}
                onChange={(e) => setLevel(e.target.value.replace(/[^\d]/g, '').slice(0, 2))} />
            </Field>
          </div>

          {student && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-page px-4 py-3 text-panel">
              <span className="text-ink-600">الحلقة{' '}
                <span className="font-medium text-ink-900">{halaqa ? shortName(halaqa.teacher) : 'بلا حلقة'}</span></span>
              <span className="text-ink-600">المسار{' '}
                <span className="font-medium text-ink-900">{student.track ? TRACK_AR[student.track] : '—'}</span></span>
              <span className="text-ink-600">المقرَّر اليومي{' '}
                <span className="font-medium text-ink-900">{dailyAmountFor(student.track!)}</span></span>
              {levelNum && ajzaForLevel(student.track, levelNum) !== null && (
                <span className="text-ink-600">يقابل{' '}
                  <span className="font-medium text-ink-900">
                    {juzPhrase(ajzaForLevel(student.track, levelNum)!)}</span></span>
              )}
            </div>
          )}

          {/* §9(f) — a level the file does not cover fails by name, loudly. */}
          {availability && !availability.ok && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-risk-200 bg-risk-100 px-4 py-3">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-risk-700" />
              <p className="text-base2 text-risk-700">{availability.reason}</p>
            </div>
          )}
        </Sheet>

        {/* ── ٣ · المعاينة ─────────────────────────────────────────────── */}
        {plan && student && availability?.ok && (
          <>
            <Sheet className="rise mb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-t1 text-ink-900">
                      معاينة المستوى <Num>{plan.level}</Num>
                    </h2>
                    {customised && <Chip tone="warn"><Pencil size={10} />مُعدَّلة</Chip>}
                    {plan.printedCount > 0 && (
                      <Chip tone="ink">طُبعت <Num>{plan.printedCount}</Num> مرة</Chip>
                    )}
                  </div>
                  <p className="mt-1.5 text-panel text-ink-600">
                    <Num>{plan.dayCount}</Num> يوم عمل ·
                    الاختبار يوم <Num>{plan.examDays.BADGE_GOLDEN}</Num> و
                    <Num>{plan.examDays.BADGE_DIAMOND}</Num>
                    {plan.printedCount > 0 && <> · سُلِّمت {relativeDay(plan.issuedAt)}</>}
                  </p>
                </div>
                <Link href={`/admin/follow-up/plan?student=${student.id}&level=${plan.level}`}>
                  <Btn icon={Pencil}>تعديل هذه الخطة</Btn>
                </Link>
              </div>
            </Sheet>

            <Sheet className="rise" pad={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-body">
                  <thead>
                    <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                      {['اليوم', 'المقرر', 'من سورة', 'آية', 'إلى سورة', 'آية', 'ملاحظة', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-start font-medium">{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      d.examBadge ? (
                        <tr key={d.dayNo} className="border-b border-ink-150 bg-brand-50">
                          <td className="px-3 py-2.5 font-medium text-ink-900"><Num>{d.dayNo}</Num></td>
                          <td className="px-3 py-2.5 font-medium text-brand-800" colSpan={6}>
                            {BADGE_AR[d.examBadge]} — خانة تاريخ في الورقة، لا مقرَّر حفظ
                          </td>
                          <td className="px-3 py-2.5" />
                        </tr>
                      ) : d.rows.map((r, i) => (
                        <tr key={`${d.dayNo}-${r.kind}`}
                          className={cx('border-b border-ink-150 transition-colors',
                            r.overridden ? 'bg-warn-100/40' : 'hover:bg-page')}>
                          {i === 0 ? (
                            <td className="px-3 py-2.5 align-top font-medium text-ink-900" rowSpan={3}>
                              <Num>{d.dayNo}</Num>
                            </td>
                          ) : null}
                          <td className="px-3 py-2.5 text-panel text-ink-600">{PLAN_KIND_AR[r.kind]}</td>
                          <td className="px-3 py-2.5 text-panel text-ink-800">{r.fromSurah || '—'}</td>
                          <td className="px-3 py-2.5 text-panel"><Num>{r.fromAyah || '—'}</Num></td>
                          <td className="px-3 py-2.5 text-panel text-ink-800">{r.toSurah || '—'}</td>
                          <td className="px-3 py-2.5 text-panel"><Num>{r.toAyah || '—'}</Num></td>
                          <td className="max-w-[10rem] truncate px-3 py-2.5 text-panel text-ink-500"
                            title={r.note}>{r.note || '—'}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            </Sheet>

            <p className="mt-4 text-panel text-ink-500">
              هذه الشاشة للعرض والطباعة. التعديل — لطالب واحد أو لكل من يأخذ المستوى — في «تعديل الخطة» بصفحة المتابعة.
            </p>
          </>
        )}

        {!student && (
          <Sheet className="rise">
            <Empty icon={FileText} title="اختر طالبًا"
              body="ابحث باسمه، فيعرف النظام حلقته ومساره ومستواه التالي، ويجهّز الورقة للمعاينة." />
          </Sheet>
        )}
      </div>

      {toast && (
        <div role="status"
          className="fade fixed bottom-6 start-1/2 z-[70] -translate-x-1/2 rounded-lg bg-brand-900 px-4 py-2.5 text-body text-white shadow-pop">
          {toast}
        </div>
      )}

    </>
  );
}

export default function Page() {
  return <Suspense><PlansScreen /></Suspense>;
}
