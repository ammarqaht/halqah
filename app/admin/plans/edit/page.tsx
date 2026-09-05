'use client';
/* تعديل الخطة — §9. Two scopes, one screen, because they are the same edit
   asked at two ranges and the difference is who it reaches:

     · طالب معيّن  — an override, his sheet alone, the master untouched
     · كل من يأخذ المستوى — the master curriculum itself

   They were on two different screens before, and the second one is the
   dangerous one, so it sits beside the first with the reach stated on screen
   and a confirmation before it saves. Both live under «الخطط», next to the
   screen that prints them — but on their own page: that one prints and never
   edits, this one edits and never prints. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Save, RotateCcw, AlertTriangle, Plus, Trash2, Check, X, Pencil, Users2, User,
  Printer, Inbox,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Modal, Field, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Grid, GridCell } from '@/components/Grid';
import { Num, juzPhrase } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import {
  resolvePlan, levelAvailable, dailyAmountFor, removeDay, insertDay, isCustomised, draftPlan,
  incompleteDays,
  DEFAULT_DAY_COUNT, coverage, type PlanRow,
} from '@/lib/curriculum';
import { ajzaExact } from '@/lib/exams';
import {
  PLAN_KIND_AR, TRACK_AR, levelsFor,
  type CurriculumDay, type PlanDayOverride, type PlanKind, type Track,
} from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

type Scope = 'student' | 'level';
const KINDS: PlanKind[] = ['MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS'];
const BADGE_AR = { BADGE_GOLDEN: 'الوسام الذهبي', BADGE_DIAMOND: 'الوسام الماسي' } as const;
const FIELDS = ['fromSurah', 'fromAyah', 'toSurah', 'toAyah', 'note'] as const;
const HEADS = ['اليوم', 'المقرَّر', 'من سورة', 'من آية', 'إلى سورة', 'إلى آية', 'ملاحظة', ''];

function PlanEditorScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();

  const scope: Scope = sp.get('scope') === 'level' ? 'level' : 'student';
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`/admin/plans/edit?${p}`, { scroll: false });
  };

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!db.students.length) {
    return (
      <>
        <TopBar title="تعديل الخطة" crumbs={['الخطط']} panelOpen={panelOpen}
          onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا توجد بيانات بعد"
              body="الخطط تُبنى من منهج الحفظ وقائمة الطلاب. ارفع ملفاتك من الصفحة الرئيسية أولًا."
              action={<Link href="/admin"><Btn variant="primary" size="lg">الصفحة الرئيسية</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="تعديل الخطة" crumbs={['الخطط']} panelOpen={panelOpen}
        onOpenPanel={() => setPanelOpen(true)}
        action={<Link href="/admin/plans"><Btn icon={Printer}>طباعة خطة</Btn></Link>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <Sheet className="rise mb-4">
          <SheetHead title="ما الذي تعدّله؟"
            meta="التعديل لطالب واحد لا يمسّ غيره. التعديل على المستوى يمسّ كل من يأخذه." />
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'student', label: 'خطة طالب معيّن', icon: User, sub: 'لا يمسّ غيره' },
              { id: 'level', label: 'كل من يأخذ المستوى', icon: Users2, sub: 'المنهج الأصلي' },
            ] as const).map((o) => (
              <button key={o.id} onClick={() => set('scope', o.id)}
                className={cx('flex items-center gap-2.5 rounded-xl border px-4 py-3 text-start transition-all duration-200',
                  scope === o.id
                    ? 'border-brand-700 bg-brand-50 text-brand-900'
                    : 'border-ink-200 bg-paper text-ink-700 hover:border-ink-300')}>
                <o.icon size={17} strokeWidth={1.9} />
                <span>
                  <span className="block text-body font-medium">{o.label}</span>
                  <span className="block text-micro text-ink-500">{o.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>

        {scope === 'student'
          ? <StudentPlanEditor onToast={setToast} />
          : <LevelCurriculumEditor onToast={setToast} />}
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

/* ── one student's sheet ──────────────────────────────────────────────────
   Written as an override, never over the curriculum, which is what makes
   «لا يُفقد الأصل أبدًا» true rather than merely promised. */
function StudentPlanEditor({ onToast }: { onToast: (s: string) => void }) {
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`/admin/plans/edit?${p}`, { scroll: false });
  };

  const [editing, setEditing] = useState<{ dayNo: number; kind: PlanKind } | null>(null);
  const [draft, setDraft] = useState<PlanRow | null>(null);
  const [confirmLevelWide, setConfirmLevelWide] = useState(false);

  const eligible = useMemo(
    () => db.students.filter((s) => s.track && s.track !== 'TALQEEN'), [db.students]);
  const student = eligible.find((s) => s.id === sp.get('student')) ?? null;
  const level = sp.get('level') ?? '';
  const levelNum = level === '' ? null : Number(level);

  /* Only the levels this track's curriculum actually holds — editing a level
     with no rows would be editing nothing. */
  const levelOptions = useMemo(() => {
    if (!student?.track) return [];
    return [...new Set(db.curriculum.filter((d) => d.track === student.track).map((d) => d.level))]
      .sort((a, b) => b - a)
      .map((n) => ({ value: String(n), label: `المستوى ${n}` }));
  }, [db.curriculum, student]);

  const availability = student?.track && levelNum
    ? levelAvailable(student.track, levelNum, db.curriculum) : null;

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
    () => (plan ? resolvePlan(plan, db.curriculum, overrides) : []), [plan, db.curriculum, overrides]);
  const customised = plan ? isCustomised(plan, overrides) : false;

  /* The sheet on screen may be a draft that exists nowhere yet. A write has to
     land on a real row, so the first edit materialises it. Creating the row
     does not move the student onto the level — printing does. */
  const materialise = () => {
    if (!plan || !student?.track) return null;
    if (!plan.id.startsWith('draft-')) return plan.id;
    return store.issuePlan({
      studentId: student.id,
      track: student.track as Exclude<typeof student.track, null>,
      level: plan.level,
      dailyAmount: plan.dailyAmount,
    }).id;
  };

  const saveRow = () => {
    if (!plan || !draft) return;
    const planId = materialise();
    if (!planId) return;
    const o: PlanDayOverride = {
      planId, dayNo: draft.dayNo, kind: draft.kind,
      fromSurah: draft.fromSurah.trim(), fromAyah: draft.fromAyah.trim(),
      toSurah: draft.toSurah.trim(), toAyah: draft.toAyah.trim(), note: draft.note.trim(),
    };
    store.setPlanOverride(o);
    setEditing(null); setDraft(null);
    onToast('حُفظ التعديل لهذا الطالب وحده.');
  };

  return (
    <>
      <Sheet className="rise mb-4">
        <SheetHead title="الطالب والمستوى" meta="اختر الطالب، ثم المستوى الذي تريد تعديل خطته" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم الطالب">
            <Combobox value={sp.get('student') ?? ''} onChange={(v) => set('student', v)}
              options={eligible.map((s) => ({
                value: s.id, label: s.fullName,
                hint: [s.track ? TRACK_AR[s.track] : 'بلا مسار',
                       s.halaqaId ? shortName(db.halaqat.find((h) => h.id === s.halaqaId)?.teacher ?? '') : 'بلا حلقة',
                       s.currentLevel != null ? `المستوى ${s.currentLevel}` : 'بلا مستوى'].join(' · '),
              })).sort((a, b) => a.label.localeCompare(b.label, 'ar'))}
              placeholder="اختر الطالب" searchPlaceholder="ابحث بالاسم…" />
          </Field>
          <Field label="المستوى"
            hint={student ? `المرفوع من مسار ${TRACK_AR[student.track!]}: ${levelOptions.length} مستوى` : 'اختر الطالب أولًا'}>
            <Combobox value={level} onChange={(v) => set('level', v)} options={levelOptions}
              placeholder={student ? 'اختر المستوى' : '—'}
              emptyText="لا مستويات مرفوعة لهذا المسار" />
          </Field>
        </div>

        {student && levelNum !== null && availability && !availability.ok && (
          <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-risk-100 px-3.5 py-3 text-panel text-risk-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />{availability.reason}
          </p>
        )}
      </Sheet>

      {plan && student && (
        <>
          <Sheet className="rise mb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-t1 text-ink-900">
                    خطة {shortName(student.fullName)} — المستوى <Num>{plan.level}</Num>
                  </h2>
                  {customised && <Chip tone="warn"><Pencil size={10} />مُعدَّلة</Chip>}
                </div>
                <p className="mt-1.5 text-panel text-ink-600">
                  <Num>{plan.dayCount}</Num> يوم عمل · الاختبار يوم{' '}
                  <Num>{plan.examDays.BADGE_GOLDEN}</Num> و<Num>{plan.examDays.BADGE_DIAMOND}</Num>
                </p>
              </div>
              {customised && (
                <div className="flex flex-wrap items-center gap-2">
                  <Btn icon={Users2} onClick={() => setConfirmLevelWide(true)}>
                    تطبيق على كل من يأخذ المستوى
                  </Btn>
                  <Btn icon={RotateCcw} onClick={() => {
                    store.restorePlan(plan.id);
                    onToast('أُعيدت الخطة إلى المنهج الأصلي.');
                  }}>إرجاع إلى الأصل</Btn>
                </div>
              )}
            </div>
          </Sheet>

          <Sheet className="rise" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-body">
                <thead>
                  <tr className="border-b border-ink-200 bg-page text-start">
                    {HEADS.map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-start text-micro font-medium text-ink-500">{h}</th>
                    ))}
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
                              {FIELDS.map((f) => (
                                <td key={f} className="px-1.5 py-1.5">
                                  <input className={cx(INPUT, 'h-8 px-2 text-panel')} value={draft[f]}
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
                                      const planId = materialise();
                                      if (!planId) return;
                                      const r2 = insertDay(plan, overrides, d.dayNo);
                                      store.updatePlan(planId, { dayCount: r2.dayCount, examDays: r2.examDays });
                                      store.replacePlanOverrides(planId, r2.overrides);
                                      onToast(`أُضيف يوم بعد اليوم ${d.dayNo}، وأُعيد ترقيم ما بعده.`);
                                    }} title="إضافة يوم بعده" aria-label={`إضافة يوم بعد اليوم ${d.dayNo}`}
                                      className="rounded p-1.5 text-ink-400 transition-colors hover:bg-brand-100 hover:text-brand-800">
                                      <Plus size={14} />
                                    </button>
                                    <button onClick={() => {
                                      const planId = materialise();
                                      if (!planId) return;
                                      const r2 = removeDay(plan, overrides, d.dayNo);
                                      store.updatePlan(planId, { dayCount: r2.dayCount, examDays: r2.examDays });
                                      store.replacePlanOverrides(planId, r2.overrides);
                                      onToast(`حُذف اليوم ${d.dayNo}، وأُعيد ترقيم ما بعده.`);
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
            {' '}<Link href={`/admin/plans?student=${student.id}`} className="text-brand-800 underline">اطبع الورقة من «الخطط»</Link>.
          </p>
        </>
      )}

      {!student && (
        <Sheet className="rise">
          <Empty icon={User} title="اختر طالبًا"
            body="التعديل هنا يخصّ خطة طالب واحد. لتغيير المنهج نفسه لكل من يأخذ مستوى، بدّل النطاق إلى «كل من يأخذ المستوى»." />
        </Sheet>
      )}

      {/* «يحتاج تأكيدًا إضافيًا لأنه يمسّ طلابًا آخرين» — §9 */}
      <Modal open={confirmLevelWide} onClose={() => setConfirmLevelWide(false)}
        title="تطبيق التعديل على كل من يأخذ هذا المستوى"
        footer={
          <>
            <Btn onClick={() => setConfirmLevelWide(false)}>تراجع</Btn>
            <Btn variant="danger" onClick={() => {
              if (plan) { store.applyPlanToLevel(plan.id); onToast('حُدِّث منهج المستوى لكل من يأخذه.'); }
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

/* ── the master curriculum for one level ──────────────────────────────────
   «لكل من يأخذ هذا المستوى». This is the dangerous edit, so the reach is on
   screen and nothing saves without the confirmation. */
const blankRow = (track: Track, level: number, dayNo: number, kind: PlanKind): CurriculumDay => ({
  track, level, dayNo, kind, fromSurah: '', fromAyah: '', toSurah: '', toAyah: '', note: '',
});

function LevelCurriculumEditor({ onToast }: { onToast: (s: string) => void }) {
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`/admin/plans/edit?${p}`, { scroll: false });
  };

  const track = (sp.get('track') as Track) || 'SILVER';
  const level = sp.get('mlevel') ?? '';
  const levelNum = level === '' ? null : Number(level);

  const [draft, setDraft] = useState<CurriculumDay[]>([]);
  const [dayCount, setDayCount] = useState(DEFAULT_DAY_COUNT);
  const [confirm, setConfirm] = useState(false);

  const cover = useMemo(() => coverage(db.curriculum), [db.curriculum]);
  const trackCover = cover.find((c) => c.track === track) ?? null;

  const levelOptions = useMemo(() => {
    const have = new Set(trackCover?.levels ?? []);
    return levelsFor(track).map((n) => ({
      value: String(n),
      label: `المستوى ${n}`,
      /* «أجزاء» with no figure named no quantity; «منتصف الجزء» named a
         situation and no quantity either. Both say the number now. */
      hint: have.has(n)
        ? (ajzaExact(track, n) !== null ? juzPhrase(ajzaExact(track, n)!) : undefined)
        : 'لا منهج بعد',
    }));
  }, [track, trackCover]);

  const stored = useMemo(
    () => db.curriculum.filter((d) => d.track === track && d.level === levelNum),
    [db.curriculum, track, levelNum]);

  useEffect(() => {
    if (levelNum === null) { setDraft([]); return; }
    const n = stored.length ? Math.max(...stored.map((d) => d.dayNo)) : DEFAULT_DAY_COUNT;
    setDayCount(n);
    const rows: CurriculumDay[] = [];
    for (let day = 1; day <= n; day++) {
      for (const kind of KINDS) {
        rows.push(stored.find((d) => d.dayNo === day && d.kind === kind)
          ?? blankRow(track, levelNum, day, kind));
      }
    }
    setDraft(rows);
  }, [stored, track, levelNum]);

  const dirty = useMemo(() => {
    if (levelNum === null) return false;
    if (draft.length !== stored.length) return true;
    return draft.some((d) => {
      const s = stored.find((x) => x.dayNo === d.dayNo && x.kind === d.kind);
      if (!s) return true;
      return FIELDS.some((f) => (s[f] ?? '') !== (d[f] ?? ''));
    });
  }, [draft, stored, levelNum]);

  const edit = (dayNo: number, kind: PlanKind, field: typeof FIELDS[number], v: string) =>
    setDraft((p) => p.map((d) => (d.dayNo === dayNo && d.kind === kind ? { ...d, [field]: v } : d)));

  const affected = levelNum === null ? 0
    : db.students.filter((s) => s.track === track && s.currentLevel === levelNum).length;

  /* Which days are not filled in. A gap prints as a blank row on a student's
     sheet, so it is named here rather than discovered on the paper. */
  const gaps = useMemo(
    () => (levelNum === null ? [] : incompleteDays(draft, dayCount)), [draft, dayCount, levelNum]);

  /* Jumping to a gap puts the caret in the first field it is missing, which is
     «من سورة» — the column the grid completes. */
  const goToGap = (day: number, kind: PlanKind) => {
    const r = (day - 1) * KINDS.length + KINDS.indexOf(kind);
    const el = document.querySelector<HTMLInputElement>(`[data-cell="${r}:0"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { el?.focus(); el?.select(); }, 320);
  };

  return (
    <>
      <Sheet className="rise mb-4">
        <SheetHead title="المسار والمستوى"
          meta="ما تكتبه هنا يصير المنهج الأصلي لهذا المستوى، لكل من يأخذه بعد الآن" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المسار">
            <div className="flex gap-2">
              {(['SILVER', 'GOLDEN'] as Track[]).map((t) => (
                <button key={t} onClick={() => set('track', t)}
                  className={cx('rounded-lg border px-4 py-2.5 text-body transition-colors',
                    track === t ? 'border-brand-700 bg-brand-50 font-medium text-brand-900'
                                : 'border-ink-200 bg-paper text-ink-700 hover:border-ink-300')}>
                  {TRACK_AR[t]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="المستوى"
            hint={`المرفوع من هذا المسار: ${trackCover?.levels.length ?? 0} مستوى`}>
            <Combobox value={level} onChange={(v) => set('mlevel', v)} options={levelOptions}
              placeholder="اختر المستوى" searchPlaceholder="ابحث برقم المستوى…" />
          </Field>
        </div>

        {levelNum !== null && (
          <p className={cx('mt-4 flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-panel',
            affected > 0 ? 'bg-warn-100 text-warn-700' : 'bg-info-100 text-info-700')}>
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {affected > 0
              ? <span><Num className="font-medium">{affected}</Num> طالبًا على هذا المستوى الآن، وسيأخذون ما تكتبه هنا. الخطط المطبوعة سابقًا لا تتغيّر.</span>
              : <span>لا طالب على هذا المستوى الآن — التعديل يظهر لمن يصل إليه لاحقًا.</span>}
          </p>
        )}
      </Sheet>

      {levelNum !== null && draft.length > 0 && (
        <>
          {gaps.length > 0 && (
            <div className="rise mb-3 rounded-xl border border-warn-200 bg-warn-100 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn-700" />
                <div className="min-w-0">
                  <p className="text-base2 font-medium text-warn-700">
                    <Num>{gaps.length}</Num> {gaps.length === 1 ? 'يوم ناقص' : gaps.length === 2 ? 'يومان ناقصان' : 'أيام ناقصة'} في هذا المستوى
                  </p>
                  <p className="mt-1 text-panel text-warn-700/85">
                    اليوم الناقص يُطبع سطرًا فارغًا في ورقة الطالب. اضغط رقم اليوم لتنتقل إليه ويُملأ.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {gaps.map((g) => (
                      <button key={g.day} onClick={() => goToGap(g.day, g.missing[0])}
                        title={`ينقصه: ${g.missing.map((k) => PLAN_KIND_AR[k]).join('، ')}`}
                        className="rounded-lg border border-warn-200 bg-paper px-2.5 py-1 text-panel text-warn-700 transition-colors hover:border-warn-700 hover:bg-warn-100">
                        اليوم <Num>{g.day}</Num>
                        {g.missing.length < KINDS.length && (
                          <span className="text-micro text-ink-500"> · <Num>{g.missing.length}</Num></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rise mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-panel text-ink-600">
              <Num className="font-medium text-ink-900">{dayCount}</Num> يوم عمل ·{' '}
              <Num className="font-medium text-ink-900">{draft.length}</Num> سطرًا
              {gaps.length === 0 && <span className="text-ok-700"> · مكتمل</span>}
            </p>
            <Btn variant="primary" icon={Save} disabled={!dirty} onClick={() => setConfirm(true)}>
              حفظ المنهج
            </Btn>
          </div>

          <Sheet className="rise" pad={false}>
            <div className="overflow-x-auto">
              <Grid rows={dayCount * KINDS.length} cols={FIELDS.length}>
              <table className="w-full min-w-[46rem] border-collapse text-body">
                <thead>
                  <tr className="border-b border-ink-200 bg-page">
                    {HEADS.slice(0, 7).map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-start text-micro font-medium text-ink-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: dayCount }, (_, i) => i + 1).map((dayNo) => (
                    KINDS.map((kind, i) => {
                      const row = draft.find((d) => d.dayNo === dayNo && d.kind === kind);
                      if (!row) return null;
                      /* One flat index across the whole sheet: the grid walks
                         off the end of a row onto the next, the way Tab does. */
                      const r = (dayNo - 1) * KINDS.length + i;
                      const above = r === 0 ? undefined
                        : draft.find((d) => d.dayNo === (i === 0 ? dayNo - 1 : dayNo)
                                         && d.kind === KINDS[(i + KINDS.length - 1) % KINDS.length]);
                      return (
                        <tr key={`${dayNo}-${kind}`} className="border-b border-ink-150">
                          {i === 0 ? (
                            <td className="px-3 py-2.5 align-top font-medium text-ink-900" rowSpan={3}>
                              <Num>{dayNo}</Num>
                            </td>
                          ) : null}
                          <td className="px-3 py-2.5 text-panel text-ink-600">{PLAN_KIND_AR[kind]}</td>
                          {FIELDS.map((f, c) => (
                            <td key={f} className="px-1.5 py-1.5">
                              <GridCell row={r} col={c} value={row[f] ?? ''}
                                onChange={(v) => edit(dayNo, kind, f, v)}
                                kind={f === 'fromSurah' || f === 'toSurah' ? 'surah'
                                    : f === 'fromAyah' || f === 'toAyah' ? 'ayah' : 'text'}
                                fillDown={above?.[f] ?? undefined}
                                ariaLabel={`${HEADS[c + 2]} — ${PLAN_KIND_AR[kind]} ليوم ${dayNo}`} />
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  ))}
                </tbody>
              </table>
              </Grid>
            </div>
          </Sheet>
        </>
      )}

      {levelNum === null && (
        <Sheet className="rise">
          <Empty icon={Users2} title="اختر مستوى"
            body="ما يُكتب هنا هو المنهج الأصلي للمستوى، ويظهر لكل طالب يأخذه بعد الآن." />
        </Sheet>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)}
        title={`حفظ منهج المستوى ${levelNum ?? ''}`}
        footer={
          <>
            <Btn onClick={() => setConfirm(false)}>تراجع</Btn>
            <Btn variant="danger" onClick={() => {
              if (levelNum !== null) {
                store.setCurriculumLevel(track, levelNum, draft);
                onToast(`حُفظ منهج المستوى ${levelNum} في المسار ${TRACK_AR[track]}.`);
              }
              setConfirm(false);
            }}>تأكيد الحفظ</Btn>
          </>
        }>
        <div className="space-y-3">
          <p className="text-base2 text-ink-700">
            سيصير ما كتبته المنهجَ الأصلي للمستوى <Num className="font-medium">{levelNum}</Num> في
            المسار <span className="font-medium">{TRACK_AR[track]}</span>.
          </p>
          <p className="rounded-lg bg-warn-100 px-3.5 py-3 text-panel text-warn-700">
            {affected > 0
              ? <><Num className="font-medium">{affected}</Num> طالبًا على هذا المستوى الآن سيأخذونه. الخطط المطبوعة سابقًا لا تتغيّر.</>
              : 'لا طالب على هذا المستوى الآن، فالتعديل يظهر لمن يصل إليه لاحقًا.'}
          </p>
        </div>
      </Modal>
    </>
  );
}

export default function Page() { return <Suspense><PlanEditorScreen /></Suspense>; }
