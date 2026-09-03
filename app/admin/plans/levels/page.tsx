'use client';
/* تعديل منهج المستوى — §9, «لكل من يأخذ هذا المستوى».
   Distinct from editing one student's sheet, which lives on /admin/plans and
   writes an override for that student alone. This edits the MASTER: every
   student who takes this level from now on gets what is written here, so the
   screen says so plainly and asks before it saves. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  BookOpen, Save, RotateCcw, AlertTriangle, Plus, Trash2, Info, CheckCircle2,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Modal, INPUT } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num, juzWord } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { DEFAULT_DAY_COUNT, DEFAULT_EXAM_DAYS, dailyAmountFor, coverage } from '@/lib/curriculum';
import { ajzaForLevel } from '@/lib/exams';
import { TRACK_AR, PLAN_KIND_AR, levelsFor, type CurriculumDay, type PlanKind, type Track } from '@/lib/types';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { cx } from '@/lib/cx';

const KINDS: PlanKind[] = ['MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS'];
const blankRow = (track: Track, level: number, dayNo: number, kind: PlanKind): CurriculumDay => ({
  track, level, dayNo, kind, fromSurah: '', fromAyah: '', toSurah: '', toAyah: '', note: '',
});

function LevelEditorScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();

  const [track, setTrack] = useState<Track>((sp.get('track') as Track) || 'SILVER');
  const [level, setLevel] = useState(sp.get('level') ?? '');
  const [draft, setDraft] = useState<CurriculumDay[]>([]);
  const [dayCount, setDayCount] = useState(DEFAULT_DAY_COUNT);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const cover = useMemo(() => coverage(db.curriculum), [db.curriculum]);
  const trackCover = cover.find((c) => c.track === track) ?? null;

  /* Only levels the curriculum actually holds — plus the one being viewed, so
     a level with no rows yet can still be opened and written from scratch. */
  const levelOptions = useMemo(() => {
    const have = new Set(trackCover?.levels ?? []);
    return levelsFor(track).map((n) => ({
      value: String(n),
      label: `المستوى ${n}`,
      hint: have.has(n)
        ? (ajzaForLevel(track, n) !== null ? juzWord(ajzaForLevel(track, n)!) : 'منتصف الجزء')
        : 'لا منهج بعد',
    }));
  }, [track, trackCover]);

  const stored = useMemo(
    () => db.curriculum.filter((d) => d.track === track && String(d.level) === level),
    [db.curriculum, track, level]);

  useEffect(() => {
    if (!level) { setDraft([]); return; }
    const n = stored.length ? Math.max(...stored.map((d) => d.dayNo)) : DEFAULT_DAY_COUNT;
    setDayCount(n);
    const rows: CurriculumDay[] = [];
    for (let day = 1; day <= n; day++) {
      for (const kind of KINDS) {
        rows.push(stored.find((d) => d.dayNo === day && d.kind === kind)
          ?? blankRow(track, Number(level), day, kind));
      }
    }
    setDraft(rows);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, track, stored.length]);

  const setCell = (dayNo: number, kind: PlanKind, field: keyof CurriculumDay, value: string) =>
    setDraft((rows) => rows.map((r) =>
      r.dayNo === dayNo && r.kind === kind ? { ...r, [field]: value } : r));

  const dirty = useMemo(() => {
    if (!level) return false;
    const same = (a: CurriculumDay, b?: CurriculumDay) =>
      b && a.fromSurah === b.fromSurah && a.fromAyah === b.fromAyah
        && a.toSurah === b.toSurah && a.toAyah === b.toAyah && a.note === b.note;
    if (draft.length !== stored.length) return draft.some((r) => r.fromSurah || r.toSurah || r.note);
    return draft.some((r) => !same(r, stored.find((s) => s.dayNo === r.dayNo && s.kind === r.kind)));
  }, [draft, stored, level]);

  const save = () => {
    /* Rows that were never filled in are not written: an empty row means "no
       assignment that day", and storing it would be indistinguishable. */
    const rows = draft.filter((r) => r.fromSurah || r.toSurah || r.note);
    store.setCurriculumLevel(track, Number(level), rows);
    setConfirm(false);
    setSaved(true);
  };

  const affected = db.students.filter((s) => s.currentLevel === Number(level) && s.track === track).length;
  const lvl = level ? Number(level) : null;
  const ajza = lvl !== null ? ajzaForLevel(track, lvl) : null;

  const days = useMemo(() => {
    const out: { dayNo: number; badge: ExamType | null; rows: CurriculumDay[] }[] = [];
    for (let d = 1; d <= dayCount; d++) {
      const badge = d === DEFAULT_EXAM_DAYS.BADGE_GOLDEN ? 'BADGE_GOLDEN'
        : d === DEFAULT_EXAM_DAYS.BADGE_DIAMOND ? 'BADGE_DIAMOND' : null;
      out.push({ dayNo: d, badge, rows: draft.filter((r) => r.dayNo === d) });
    }
    return out;
  }, [draft, dayCount]);

  return (
    <>
      <TopBar title="تعديل منهج المستوى" crumbs={['الخطط']} panelOpen={panelOpen}
        onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/plans"><Btn>طباعة خطة لطالب</Btn></Link>
            <Btn variant="primary" icon={Save} disabled={!dirty} onClick={() => setConfirm(true)}>
              حفظ المنهج
            </Btn>
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <Sheet className="rise mb-4">
          <SheetHead title="المسار والمستوى"
            meta="اختر المستوى برقمه، فيظهر منهجه أيامًا — وما تكتبه هنا يسري على كل من يأخذ هذا المستوى" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-xs2 font-medium text-ink-600">المسار</span>
              <div className="flex gap-2">
                {(['SILVER', 'GOLDEN'] as Track[]).map((t) => (
                  <button key={t} onClick={() => { setTrack(t); setLevel(''); }}
                    className={cx('flex-1 rounded-md border px-3 py-2.5 text-body transition-colors',
                      track === t ? 'border-brand-700 bg-brand-50 font-medium text-brand-800'
                                  : 'border-ink-200 bg-paper text-ink-700 hover:border-ink-300')}>
                    {TRACK_AR[t]}
                    <span className="ms-2 text-micro text-ink-500">
                      <Num>{cover.find((c) => c.track === t)?.count ?? 0}</Num> مستوى
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs2 font-medium text-ink-600">المستوى</span>
              <Combobox value={level} onChange={setLevel} options={levelOptions}
                placeholder="اختر المستوى" searchPlaceholder="اكتب رقم المستوى…" />
            </div>
          </div>
        </Sheet>

        {!level ? (
          <Sheet className="rise">
            <Empty icon={BookOpen} title="اختر مستوى"
              body="المسار الفضي ستون مستوى والذهبي ثلاثون، وكل مستوى أربعة وعشرون يوم عمل. اختر رقمه ليظهر منهجه." />
          </Sheet>
        ) : (
          <>
            {saved && (
              <div className="fade mb-4 flex items-center gap-3 rounded-xl border border-ok-200 bg-ok-100 p-4">
                <CheckCircle2 size={18} className="shrink-0 text-ok-700" />
                <p className="text-base2 text-ok-700">حُفظ منهج المستوى {level}.</p>
              </div>
            )}

            <div className="rise mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-lg2 font-bold text-ink-900">
                  {TRACK_AR[track]} · المستوى <Num>{level}</Num>
                  {ajza !== null && <span className="ms-2 text-panel font-normal text-ink-600">{juzWord(ajza)}</span>}
                </p>
                <p className="mt-1 text-panel text-ink-600">
                  المقرّر اليومي {dailyAmountFor(track)} · <Num>{dayCount}</Num> يوم عمل
                  {affected > 0 && <> · <Num className="font-medium text-brand-800">{affected}</Num> طالبًا على هذا المستوى الآن</>}
                </p>
              </div>
              {stored.length === 0 && <Chip tone="warn">لا منهج محفوظ — اكتبه</Chip>}
            </div>

            <Sheet className="rise" pad={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[54rem] border-collapse text-panel">
                  <thead>
                    <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                      <th className="w-14 px-3 py-3 text-start font-medium">اليوم</th>
                      <th className="w-20 px-3 py-3 text-start font-medium">المقرر</th>
                      <th className="px-3 py-3 text-start font-medium">من سورة</th>
                      <th className="w-24 px-3 py-3 text-start font-medium">آية</th>
                      <th className="px-3 py-3 text-start font-medium">إلى سورة</th>
                      <th className="w-24 px-3 py-3 text-start font-medium">آية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      d.badge ? (
                        <tr key={d.dayNo} className="border-b border-ink-150 bg-warn-100/40">
                          <td className="px-3 py-3"><Num className="font-medium text-ink-800">{d.dayNo}</Num></td>
                          <td colSpan={5} className="px-3 py-3">
                            <Chip tone="warn">{EXAM_TYPE_AR[d.badge]}</Chip>
                            <span className="ms-2 text-micro text-ink-500">
                              يوم اختبار — يحمل خانة تاريخ في الورقة، لا مقرّر حفظ
                            </span>
                          </td>
                        </tr>
                      ) : d.rows.map((r, i) => (
                        <tr key={`${d.dayNo}-${r.kind}`}
                          className={cx('border-b border-ink-150', i === 0 && 'border-t-2 border-t-ink-150')}>
                          {i === 0 && (
                            <td rowSpan={d.rows.length} className="border-e border-ink-150 px-3 py-2 align-top">
                              <Num className="font-medium text-ink-800">{d.dayNo}</Num>
                            </td>
                          )}
                          <td className="px-3 py-2 text-ink-600">{PLAN_KIND_AR[r.kind]}</td>
                          {(['fromSurah', 'fromAyah', 'toSurah', 'toAyah'] as const).map((field) => (
                            <td key={field} className="px-2 py-1.5">
                              <input value={r[field]}
                                onChange={(e) => setCell(d.dayNo, r.kind, field, e.target.value)}
                                placeholder={field.includes('Ayah') ? '١ أو آخر' : '—'}
                                className="h-9 w-full rounded border border-transparent bg-transparent px-2 text-panel text-ink-900 transition-colors placeholder:text-ink-300 hover:border-ink-200 focus:border-brand-700 focus:bg-paper focus:outline-none" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            </Sheet>

            <div className="rise mt-4 flex items-start gap-3 rounded-xl border border-ink-200 bg-paper p-4">
              <Info size={17} className="mt-0.5 shrink-0 text-ink-500" />
              <p className="text-panel leading-relaxed text-ink-600">
                الصف الفارغ يعني «لا مقرّر في هذا اليوم» ولا يُحفظ.
                ولتعديل ورقة <strong>طالب بعينه</strong> دون المساس بالمستوى، افتح{' '}
                <Link href="/admin/plans" className="text-brand-800 hover:underline">شاشة الخطط</Link>{' '}
                واختره — التعديل هناك يخصّه وحده.
              </p>
            </div>
          </>
        )}
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="حفظ منهج المستوى"
        footer={<>
          <Btn onClick={() => setConfirm(false)}>إلغاء</Btn>
          <Btn variant="primary" onClick={save}>نعم، احفظ</Btn>
        </>}>
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-warn-100 p-2 text-warn-700"><AlertTriangle size={18} /></span>
          <div>
            <p className="text-base2 text-ink-900">
              سيُحفظ منهج <strong>{TRACK_AR[track]} · المستوى {level}</strong>.
            </p>
            <p className="mt-2 text-panel text-ink-600">
              هذا يمسّ <strong>كل من يأخذ هذا المستوى</strong>، لا طالبًا بعينه.
              {affected > 0 && <> وعليه الآن <Num className="font-medium">{affected}</Num> طالبًا.</>}
              {' '}الأوراق المطبوعة سلفًا لا تتغيّر.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function Page() { return <Suspense><LevelEditorScreen /></Suspense>; }
