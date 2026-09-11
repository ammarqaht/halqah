'use client';
/* تعديل الخطة — §9. ONE scope: the level.

   «تعديل خطة كاملة للطلاب كلهم» — a level's sheet is one sheet, and editing it
   reaches everyone who takes that level from then on. There is no per-student
   edit and no override layer behind this screen: two students on level 26 hold
   the same paper, always, and the only way to change what one of them recites
   is to change what all of them recite.

   That makes this the far-reaching edit, so the reach is stated on screen —
   how many students are on the level right now — and nothing saves without a
   confirmation. It lives under «الخطط» next to the screen that prints them,
   but on its own page: that one prints and never edits, this one edits and
   never prints. Sheets already printed are paper; they do not change. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, AlertTriangle, Users2, Printer, Inbox } from 'lucide-react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Modal, Field } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Grid, GridCell } from '@/components/Grid';
import { Num, juzPhrase } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { incompleteDays, DEFAULT_DAY_COUNT, coverage } from '@/lib/curriculum';
import { ajzaExact } from '@/lib/exams';
import { ASSOCIATION_NOTE } from '@/lib/importers/curriculum';
import {
  PLAN_KIND_AR, TRACK_AR, levelsFor,
  type CurriculumDay, type PlanKind, type Track,
} from '@/lib/types';
import { cx } from '@/lib/cx';

const KINDS: PlanKind[] = ['MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS'];
const FIELDS = ['fromSurah', 'fromAyah', 'toSurah', 'toAyah', 'note'] as const;
const HEADS = ['اليوم', 'المقرَّر', 'من سورة', 'من آية', 'إلى سورة', 'إلى آية', 'ملاحظة', ''];

function PlanEditorScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();

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
        <LevelCurriculumEditor onToast={setToast} />
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

  /* «اختبار الجمعية» lives in the note of that day's م.ك row — the same place
     the client's own workbook puts it — so the sheet, the student's plan and
     the importer all keep reading one field. Anything else the supervisor
     wrote in that note is preserved either way. */
  /** The days this level marks — shown above the table so he can see them at
      a glance instead of scrolling twenty-four rows to find the tick. */
  const assocDays = draft
    .filter((d) => d.kind === 'MURAJAA_KUBRA' && d.note.includes(ASSOCIATION_NOTE))
    .map((d) => d.dayNo).sort((a, b) => a - b);

  const hasAssociation = (dayNo: number) =>
    (draft.find((d) => d.dayNo === dayNo && d.kind === 'MURAJAA_KUBRA')?.note ?? '')
      .includes(ASSOCIATION_NOTE);

  const setAssociation = (dayNo: number, on: boolean) =>
    setDraft((p) => p.map((d) => {
      if (d.dayNo !== dayNo || d.kind !== 'MURAJAA_KUBRA') return d;
      const rest = d.note.split('·').map((x) => x.trim())
        .filter((x) => x && x !== ASSOCIATION_NOTE);
      const parts = on ? [...rest, ASSOCIATION_NOTE] : rest;
      return { ...d, note: parts.join(' · ') };
    }));

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
              {assocDays.length > 0 && (
                <span className="text-assoc-700">
                  {' '}· اختبار الجمعية يوم{' '}
                  {assocDays.map((d) => <Num key={d}>{d}</Num>)
                    .reduce((a, b) => <>{a}، {b}</>)}
                </span>
              )}
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
                            <td className="px-3 py-2.5 align-top" rowSpan={3}>
                              <span className="block font-medium text-ink-900"><Num>{dayNo}</Num></span>
                              {/* Which day carries «اختبار الجمعية» is the
                                  client's to set: the file marks some and the
                                  halaqa may move one. It is stored where the
                                  file stores it — the note on that day's
                                  م.ك row — so nothing else has to learn a new
                                  place to look. */}
                              <label className="mt-1.5 flex cursor-pointer items-start gap-1.5"
                                title="يوم اختبار الجمعية">
                                <input type="checkbox" checked={hasAssociation(dayNo)}
                                  onChange={(e) => setAssociation(dayNo, e.target.checked)}
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm border-ink-300 accent-assoc-700" />
                                <span className="text-[10px] leading-tight text-ink-500">جمعية</span>
                              </label>
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
