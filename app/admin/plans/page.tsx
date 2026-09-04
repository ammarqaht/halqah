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
  FileText, Printer, RotateCcw, Plus, Trash2, AlertTriangle, Inbox, UploadCloud,
  Pencil, Check, X, Award,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Modal, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num, juzWord } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import {
  resolvePlan, levelAvailable, dailyAmountFor, removeDay, insertDay, isCustomised,
  type PlanRow,
} from '@/lib/curriculum';
import { nextLevel, ajzaForLevel } from '@/lib/exams';
import { PLAN_KIND_AR, TRACK_AR, type PlanDayOverride, type PlanKind, type Track } from '@/lib/types';
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
  const [editing, setEditing] = useState<{ dayNo: number; kind: PlanKind } | null>(null);
  const [draft, setDraft] = useState<PlanRow | null>(null);
  const [confirmLevelWide, setConfirmLevelWide] = useState(false);
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

  /* «النظام يعرف مستوى الطالب الحالي … فيجهّز له المستوى التالي مباشرة» */
  const suggested = student?.currentLevel != null ? nextLevel(student.currentLevel) : null;
  useEffect(() => {
    setLevel(suggested != null ? String(suggested) : '');
    setEditing(null);
  }, [suggested, studentId]);

  const levelNum = level === '' ? null : Number(level);
  const availability = student?.track && levelNum
    ? levelAvailable(student.track, levelNum, db.curriculum) : null;

  /* The plan record exists as soon as there is something to preview; printing
     is what stamps it. Issuing is idempotent per (student, level). */
  const plan = useMemo(() => {
    if (!student?.track || !levelNum || !availability?.ok) return null;
    return store.issuePlan({
      studentId: student.id,
      track: student.track as Exclude<typeof student.track, null>,
      level: levelNum,
      dailyAmount: dailyAmountFor(student.track),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, levelNum, availability?.ok, db.plans.length]);

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

  const saveRow = () => {
    if (!plan || !draft) return;
    const o: PlanDayOverride = {
      planId: plan.id, dayNo: draft.dayNo, kind: draft.kind,
      fromSurah: draft.fromSurah.trim(), fromAyah: draft.fromAyah.trim(),
      toSurah: draft.toSurah.trim(), toAyah: draft.toAyah.trim(), note: draft.note.trim(),
    };
    store.setPlanOverride(o);
    setEditing(null); setDraft(null);
  };

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
            {plan && availability?.ok && (
              <a href={`/print/plan/${plan.id}`} target="_blank" rel="noreferrer">
                <Btn variant="primary" icon={Printer}>طباعة وحفظ التاريخ</Btn>
              </a>
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
              hint={suggested != null
                ? `مستواه الحالي ${student?.currentLevel} — والتالي ${suggested}`
                : 'لا مستوى محفوظ لهذا الطالب، فاكتبه'}>
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
                    <Num>{ajzaForLevel(student.track, levelNum)}</Num> {juzWord(ajzaForLevel(student.track, levelNum)!)}</span></span>
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
        {plan && availability?.ok && (
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
                {customised && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Btn icon={Award} onClick={() => setConfirmLevelWide(true)}>
                      تطبيق على كل من يأخذ المستوى
                    </Btn>
                    <Btn icon={RotateCcw} onClick={() => {
                      store.restorePlan(plan.id);
                      setToast('أُعيدت الخطة إلى المنهج الأصلي.');
                    }}>إرجاع إلى الأصل</Btn>
                  </div>
                )}
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
                      ) : d.rows.map((r, i) => {
                        const on = editing?.dayNo === d.dayNo && editing?.kind === r.kind;
                        return (
                          <tr key={`${d.dayNo}-${r.kind}`}
                            className={cx('border-b border-ink-150 transition-colors',
                              on ? 'bg-brand-50' : r.overridden ? 'bg-warn-100/40' : 'hover:bg-page')}>
                            {i === 0 ? (
                              <td className="px-3 py-2.5 align-top font-medium text-ink-900" rowSpan={3}>
                                <Num>{d.dayNo}</Num>
                              </td>
                            ) : null}
                            <td className="px-3 py-2.5 text-panel text-ink-600">{PLAN_KIND_AR[r.kind]}</td>
                            {on && draft ? (
                              <>
                                {(['fromSurah', 'fromAyah', 'toSurah', 'toAyah', 'note'] as const).map((f) => (
                                  <td key={f} className="px-1.5 py-1.5">
                                    <input className={cx(INPUT, 'h-8 px-2 text-panel')}
                                      value={draft[f]}
                                      onChange={(e) => setDraft({ ...draft, [f]: e.target.value })} />
                                  </td>
                                ))}
                                <td className="whitespace-nowrap px-2 py-1.5">
                                  <button onClick={saveRow} title="حفظ" aria-label="حفظ السطر"
                                    className="rounded p-1.5 text-ok-700 hover:bg-ok-100"><Check size={15} /></button>
                                  <button onClick={() => { setEditing(null); setDraft(null); }}
                                    title="إلغاء" aria-label="إلغاء التعديل"
                                    className="rounded p-1.5 text-ink-400 hover:bg-ink-100"><X size={15} /></button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2.5 text-panel text-ink-800">{r.fromSurah || '—'}</td>
                                <td className="px-3 py-2.5 text-panel"><Num>{r.fromAyah || '—'}</Num></td>
                                <td className="px-3 py-2.5 text-panel text-ink-800">{r.toSurah || '—'}</td>
                                <td className="px-3 py-2.5 text-panel"><Num>{r.toAyah || '—'}</Num></td>
                                <td className="max-w-[10rem] truncate px-3 py-2.5 text-panel text-ink-500"
                                  title={r.note}>{r.note || '—'}</td>
                                <td className="whitespace-nowrap px-2 py-2.5 text-end">
                                  <button onClick={() => { setEditing({ dayNo: d.dayNo, kind: r.kind }); setDraft(r); }}
                                    title="تعديل هذا السطر" aria-label={`تعديل ${PLAN_KIND_AR[r.kind]} ليوم ${d.dayNo}`}
                                    className="rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900">
                                    <Pencil size={14} />
                                  </button>
                                  {i === 0 && (
                                    <>
                                      <button onClick={() => {
                                        const r2 = insertDay(plan, overrides, d.dayNo);
                                        store.updatePlan(plan.id, { dayCount: r2.dayCount, examDays: r2.examDays });
                                        store.replacePlanOverrides(plan.id, r2.overrides);
                                        setToast(`أُضيف يوم بعد اليوم ${d.dayNo}، وأُعيد ترقيم ما بعده.`);
                                      }} title="إضافة يوم بعده" aria-label={`إضافة يوم بعد اليوم ${d.dayNo}`}
                                        className="rounded p-1.5 text-ink-400 transition-colors hover:bg-brand-100 hover:text-brand-800">
                                        <Plus size={14} />
                                      </button>
                                      <button onClick={() => {
                                        const r2 = removeDay(plan, overrides, d.dayNo);
                                        store.updatePlan(plan.id, { dayCount: r2.dayCount, examDays: r2.examDays });
                                        store.replacePlanOverrides(plan.id, r2.overrides);
                                        setToast(`حُذف اليوم ${d.dayNo}، وأُعيد ترقيم ما بعده.`);
                                      }} title="حذف هذا اليوم" aria-label={`حذف اليوم ${d.dayNo}`}
                                        className="rounded p-1.5 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700">
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              </div>
            </Sheet>

            <p className="mt-4 text-panel text-ink-500">
              التعديل يُحفظ لهذا الطالب وحده، والمنهج الأصلي لا يُمَسّ — ولذلك يعمل زرّ الإرجاع دائمًا.
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

      {/* «يحتاج تأكيدًا إضافيًا لأنه يمسّ طلابًا آخرين» — §9 */}
      <Modal open={confirmLevelWide} onClose={() => setConfirmLevelWide(false)}
        title="تطبيق التعديل على كل من يأخذ هذا المستوى"
        footer={
          <>
            <Btn onClick={() => setConfirmLevelWide(false)}>تراجع</Btn>
            <Btn variant="danger" onClick={() => {
              if (plan) { store.applyPlanToLevel(plan.id); setToast('حُدِّث منهج المستوى لكل من يأخذه.'); }
              setConfirmLevelWide(false);
            }}>تأكيد التطبيق</Btn>
          </>
        }>
        <div className="space-y-3">
          <p className="text-base2 text-ink-700">
            سيُحدَّث منهج المستوى <Num className="font-medium">{plan?.level}</Num> في المسار{' '}
            <span className="font-medium">{plan ? TRACK_AR[plan.track] : ''}</span> نفسه، فتظهر
            تعديلاتك لكل طالب يأخذ هذا المستوى بعد الآن.
          </p>
          <p className="rounded-lg bg-warn-100 px-3.5 py-3 text-panel text-warn-700">
            هذا يمسّ طلابًا آخرين، ولذلك يحتاج تأكيدًا إضافيًا. الخطط المطبوعة سابقًا لا تتغيّر.
          </p>
        </div>
      </Modal>
    </>
  );
}

export default function Page() {
  return <Suspense><PlansScreen /></Suspense>;
}
