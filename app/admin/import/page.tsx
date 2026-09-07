'use client';
/* رفع الملفات — SPEC.md §5. The only upload surface in the system.
   It lives on the home page and nowhere else: one drop fills the students, the
   halaqat, the exams, the plans and the curriculum at once, so the supervisor
   never has to work out which screen a file belongs to.
   parse → classify → PREVIEW → commit. Nothing is written before he confirms,
   and an import never deletes. */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft,
  Loader2, XCircle, X, ChevronLeft, Users2, ClipboardList, CalendarRange, BookMarked,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet } from '@/components/Sheet';
import { Btn, Chip, Empty } from '@/components/ui';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { KIND_AR } from '@/lib/importers/detect';
import { readWorkbook, type WorkbookRead, type SheetOutcome } from '@/lib/importers/workbook';
import { ISSUE_AR } from '@/lib/importers/roster';
import { useDB, store } from '@/lib/store';
import { shortName } from '@/lib/normalise';
import { TRACK_AR } from '@/lib/types';
import { cx } from '@/lib/cx';

type Job = { id: string; name: string; read: WorkbookRead | null; error?: string };
const uid = () => Math.random().toString(36).slice(2, 9);

/* What each part of a workbook fills, said in the supervisor's own terms —
   he thinks in screens, not in table names. */
const FILLS: { key: keyof Totals; label: string; icon: LucideIcon; where: string }[] = [
  { key: 'students',   label: 'طالبًا',  icon: Users2,        where: 'الطلاب والحلقات' },
  { key: 'exams',      label: 'اختبارًا', icon: ClipboardList, where: 'الاختبارات والتقارير' },
  { key: 'plans',      label: 'خطة',     icon: CalendarRange, where: 'الخطط والمتابعة' },
  { key: 'curriculum', label: 'مستوى',   icon: BookMarked,    where: 'منهج الحفظ' },
];

type Totals = {
  students: number; halaqat: number; exams: number; plans: number;
  curriculum: number; flagged: number; unmatched: number; skipped: number;
};

export default function ImportPage() {
  const { panelOpen, setPanelOpen } = usePanel();
  const router = useRouter();
  const db = useDB();
  const fileRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState<(Totals & { files: number; synced: boolean }) | null>(null);
  const [error, setError] = useState('');

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const files = [...list].filter((f) => /\.xlsx?$/i.test(f.name));
    if (!files.length) { setError('لم أتعرّف على ملف إكسل. الصيغ المقبولة: ‎.xlsx‎ و‎.xls‎'); return; }
    setError(''); setBusy(true);

    const next: Job[] = [];
    /* Each file is read against everything read so far — the roster in the
       first workbook lets the exam log in the second find its students. */
    const seen = [...db.students];
    for (const f of files) {
      try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
        const read = readWorkbook(wb, f.name, seen);
        seen.push(...read.payload.students);
        next.push({ id: uid(), name: f.name, read });
      } catch {
        next.push({ id: uid(), name: f.name, read: null, error: 'تعذّرت قراءة الملف — قد يكون تالفًا أو محميًا بكلمة مرور.' });
      }
    }
    setJobs((p) => [...p, ...next]);
    setOpenId((p) => p ?? next.find((j) => j.read)?.id ?? null);
    setBusy(false);
  }, [db.students]);

  const remove = (id: string) => {
    setJobs((p) => p.filter((j) => j.id !== id));
    setOpenId((p) => (p === id ? null : p));
  };

  const ready = jobs.filter((j) => j.read && hasContent(j.read));

  const totals: Totals = useMemo(() => {
    const t: Totals = { students: 0, halaqat: 0, exams: 0, plans: 0, curriculum: 0, flagged: 0, unmatched: 0, skipped: 0 };
    /* Students and halaqat are counted across files, not summed: the same
       roster in two workbooks is one hundred and two students, not two hundred. */
    const sKeys = new Set<string>(); const hNames = new Set<string>();
    for (const j of ready) {
      const s = j.read!.summary;
      for (const st of j.read!.payload.students) if (st.dedupeKey) sKeys.add(st.dedupeKey);
      for (const h of j.read!.payload.halaqat) hNames.add(h.name);
      t.exams += s.exams; t.plans += s.plans; t.curriculum += s.curriculumLevels;
      t.flagged += s.flagged; t.unmatched += s.unmatched; t.skipped += s.skipped;
    }
    t.students = sKeys.size; t.halaqat = hNames.size;
    return t;
  }, [ready]);

  const commit = async () => {
    setBusy(true);
    let synced = true;
    for (const j of ready) {
      const p = j.read!.payload;
      store.ingest({ ...p, sourceFile: j.name });
      /* The browser parsed it; the server keeps it. Without this the upload
         would only ever exist in the tab that made it. */
      if (p.students.length || p.halaqat.length) {
        try {
          const res = await fetch('/api/import', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: p.students, halaqat: p.halaqat, fileName: j.name }),
          });
          if (!res.ok) synced = false;
        } catch { synced = false; }
      }
    }
    setBusy(false);
    setDone({ ...totals, files: ready.length, synced });
  };

  const open = jobs.find((j) => j.id === openId) ?? null;

  /* ── done ──────────────────────────────────────────────────────────────── */
  if (done) {
    return (
      <>
        <TopBar title="رفع الملفات" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={CheckCircle2} title="تم الاستيراد"
              body={`من ${done.files} ${done.files === 1 ? 'ملف' : 'ملفات'} — والبيانات ظهرت في كل الشاشات.`}
              action={<div className="flex flex-wrap justify-center gap-2">
                <Btn onClick={() => { setJobs([]); setDone(null); }}>رفع ملفات أخرى</Btn>
                <Btn variant="primary" size="lg" onClick={() => router.push('/admin')}>
                  <ArrowLeft size={16} /> الصفحة الرئيسية</Btn>
              </div>} />

            <div className="mt-6 grid gap-3 border-t border-ink-150 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              {FILLS.map((f) => (
                <div key={f.key} className="rounded-xl border border-ink-150 bg-page/50 px-4 py-3.5">
                  <div className="flex items-center gap-2 text-ink-500"><f.icon size={15} />
                    <span className="text-micro">{f.where}</span></div>
                  <p className="mt-1.5 text-lg2 font-bold text-ink-900">
                    <Num>{done[f.key]}</Num> <span className="text-base2 font-normal text-ink-600">{f.label}</span>
                  </p>
                </div>
              ))}
            </div>

            {!done.synced && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-warn-200 bg-warn-100 p-3.5 text-panel text-warn-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                حُفظت البيانات في هذا الجهاز، لكن تعذّر إرسال الطلاب إلى الخادم — أعد المحاولة حين يعود الاتصال ليراها بقية الأجهزة.
              </p>
            )}
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="رفع الملفات" crumbs={['الصفحة الرئيسية']} panelOpen={panelOpen}
        onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            {jobs.length > 0 && <Btn onClick={() => { setJobs([]); setOpenId(null); }}>مسح القائمة</Btn>}
            <Btn onClick={() => router.push('/admin/settings')}>تصفير البيانات</Btn>
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <header className="rise mb-7">
          <h2 className="font-display text-d1 text-ink-900">ارفع ملفاتك</h2>
          <p className="mt-2 max-w-[46rem] text-base2 text-ink-600">
            اسحب ملفًا واحدًا أو عدة ملفات معًا. النظام يقرأ كل ورقة في الملف ويتعرّف عليها بنفسه —
            الطلاب والحلقات والاختبارات والخطط ومنهج الحفظ — وينشرها على شاشات الموقع كلّها.
            ولن يُحفظ شيء قبل أن تراجع المعاينة وتضغط «اعتماد».
          </p>
        </header>

        {/* ── drop zone ──────────────────────────────────────────────────── */}
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={cx('rise flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-colors duration-200',
            jobs.length ? 'px-6 py-8' : 'px-6 py-16',
            drag ? 'border-brand-700 bg-brand-50' : 'border-ink-200 bg-paper hover:border-brand-300 hover:bg-brand-50/40')}>
          <span className="mb-3 rounded-2xl bg-brand-100 p-3.5 text-brand-800"><UploadCloud size={24} strokeWidth={1.7} /></span>
          <p className="text-lg2 font-medium text-ink-900">
            {jobs.length ? 'أضف ملفات أخرى' : 'اسحب ملفات الإكسل هنا'}
          </p>
          <p className="mt-1.5 text-base2 text-ink-500">أو اضغط للاختيار — يمكنك اختيار أكثر من ملف</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {busy && (
          <div className="mt-4 flex items-center justify-center gap-2 text-base2 text-ink-600">
            <Loader2 size={17} className="animate-spin text-brand-700" /> جارٍ القراءة…
          </div>
        )}
        {error && (
          <div className="rise mt-4 flex items-start gap-3 rounded-xl border border-risk-200 bg-risk-100 p-4">
            <XCircle size={18} className="mt-0.5 shrink-0 text-risk-700" />
            <p className="text-base2 text-risk-700">{error}</p>
          </div>
        )}

        {/* ── file queue ─────────────────────────────────────────────────── */}
        {jobs.length > 0 && (
          <Sheet className="rise mt-6" pad={false}>
            <div className="border-b border-ink-150 px-6 py-4">
              <h3 className="text-lg2 font-bold text-ink-900">
                الملفات <Num className="text-ink-500">({jobs.length})</Num>
              </h3>
              <p className="mt-1 text-xs2 text-ink-500">اضغط ملفًا لتفحص ما قرأه النظام منه</p>
            </div>
            <ul className="divide-y divide-ink-150">
              {jobs.map((j) => {
                const s = j.read?.summary;
                const usable = j.read ? j.read.sheets.filter((x) => x.kind !== 'UNSUPPORTED').length : 0;
                return (
                  <li key={j.id}>
                    <div className={cx('flex items-center gap-3 px-6 py-3.5 transition-colors',
                      openId === j.id ? 'bg-brand-50' : 'hover:bg-page/60')}>
                      <button onClick={() => setOpenId(openId === j.id ? null : j.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-start">
                        <FileSpreadsheet size={17} className={cx('shrink-0', j.error ? 'text-risk-500' : 'text-brand-700')} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-medium text-ink-900">{j.name}</span>
                          <span className="mt-0.5 block truncate text-micro text-ink-500">
                            {j.error ? j.error : `${usable} ${usable === 1 ? 'ورقة مقروءة' : 'أوراق مقروءة'} من ${j.read?.sheets.length ?? 0}`}
                          </span>
                        </span>
                        {s && s.students > 0 && <Chip tone="ok"><Num>{s.students}</Num> طالبًا</Chip>}
                        {s && s.exams > 0 && <Chip tone="ok"><Num>{s.exams}</Num> اختبارًا</Chip>}
                        {s && s.plans > 0 && <Chip tone="ok"><Num>{s.plans}</Num> خطة</Chip>}
                        {s && s.curriculumLevels > 0 && <Chip tone="ok"><Num>{s.curriculumLevels}</Num> مستوى</Chip>}
                        {s && s.flagged > 0 && <Chip tone="warn"><Num>{s.flagged}</Num> للمراجعة</Chip>}
                        {j.read && !hasContent(j.read) && <Chip tone="ink">لا شيء لاستيراده</Chip>}
                        {j.error && <Chip tone="risk">تعذّر</Chip>}
                        <ChevronLeft size={15} className={cx('shrink-0 text-ink-400 transition-transform',
                          openId === j.id && '-rotate-90')} />
                      </button>
                      <button onClick={() => remove(j.id)} aria-label={`إزالة ${j.name}`}
                        className="shrink-0 rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-risk-700">
                        <X size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Sheet>
        )}

        {/* ── what the opened file holds ─────────────────────────────────── */}
        {open?.read && <WorkbookPreview read={open.read} />}

        {/* ── commit bar ─────────────────────────────────────────────────── */}
        {ready.length > 0 && (
          <div className="rise sticky bottom-0 -mx-6 mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ink-150 bg-page/90 px-6 py-4 backdrop-blur-md">
            <p className="text-panel text-ink-600">
              من <Num className="font-medium text-ink-900">{ready.length}</Num> {ready.length === 1 ? 'ملف' : 'ملفات'}:
              {' '}<Num className="font-medium text-ink-900">{totals.students}</Num> طالبًا،
              {' '}<Num className="font-medium text-ink-900">{totals.exams}</Num> اختبارًا،
              {' '}<Num className="font-medium text-ink-900">{totals.plans}</Num> خطة،
              {' '}<Num className="font-medium text-ink-900">{totals.curriculum}</Num> مستوى
              {totals.flagged > 0 && <> · <Num className="font-medium text-warn-700">{totals.flagged}</Num> تحتاج مراجعتك</>}
              . الاستيراد يضيف ويحدّث فقط — <strong>لا يحذف أحدًا ولا يمسح حقلًا لا يحمله الملف</strong>.
            </p>
            <Btn variant="primary" size="lg" onClick={commit} disabled={busy}>
              {busy ? <><Loader2 size={16} className="animate-spin" /> جارٍ الحفظ…</> : 'اعتماد الاستيراد'}
            </Btn>
          </div>
        )}
      </div>
    </>
  );
}

const hasContent = (r: WorkbookRead) =>
  r.payload.students.length > 0 || r.payload.exams.length > 0 ||
  r.payload.plans.length > 0 || r.payload.curriculum.length > 0;

/* ── per-workbook preview ──────────────────────────────────────────────── */
function WorkbookPreview({ read }: { read: WorkbookRead }) {
  const db = useDB();
  const halaqaName = (id: string | null) => {
    if (!id) return '— بلا حلقة —';
    const local = read.payload.halaqat.find((h) => h.id === id);
    if (local) return shortName(local.teacher || local.name);
    return shortName(db.halaqat.find((h) => h.id === id)?.teacher ?? '') || '— بلا حلقة —';
  };

  const roster = read.sheets.find((s) => 'roster' in s) as Extract<SheetOutcome, { roster: unknown }> | undefined;
  const flagged = roster?.roster.rows.filter((r) => r.issues.length) ?? [];

  return (
    <div className="fade mt-4 space-y-4">
      {/* each sheet, and what came out of it */}
      <Sheet pad={false}>
        <div className="border-b border-ink-150 px-6 py-4">
          <h3 className="text-lg2 font-bold text-ink-900">أوراق «{read.fileName}»</h3>
          <p className="mt-1 text-xs2 text-ink-500">
            كل ورقة صُنّفت من عناوين أعمدتها. ما لم يُتعرّف عليه يُترك، ولا يُخمَّن.
          </p>
        </div>
        <ul className="divide-y divide-ink-150">
          {read.sheets.map((s) => (
            <li key={s.scan.sheet} className="flex items-center gap-3 px-6 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink-900">{s.scan.sheet}</span>
                <span className="mt-0.5 block text-micro text-ink-500">
                  {KIND_AR[s.scan.kind]} · <Num>{s.scan.dataRows}</Num> صفًا
                </span>
              </span>
              {s.kind === 'UNSUPPORTED'
                ? <Chip tone="ink">متجاهَلة</Chip>
                : <Chip tone="ok">{outcomeLabel(s)}</Chip>}
            </li>
          ))}
        </ul>
      </Sheet>

      {/* names the file mentions that no roster knows — reported, never invented */}
      {read.summary.unmatched > 0 && (
        <Sheet>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn-700" />
            <p className="text-base2 text-ink-700">
              <Num className="font-medium">{read.summary.unmatched}</Num> صفًا يذكر اسمًا لا يوجد في قائمة الطلاب —
              طلاب سابقون على الأغلب. تُركت كما هي بدل أن يُنشئ لها النظام طلابًا وهميين.
              ارفع قاعدة بيانات الحلقات معها لتُربط بأصحابها.
            </p>
          </div>
        </Sheet>
      )}

      {/* rows the roster wants a human to look at */}
      {flagged.length > 0 && (
        <Sheet pad={false}>
          <div className="border-b border-ink-150 px-6 py-4">
            <h3 className="text-lg2 font-bold text-ink-900">
              تحتاج مراجعتك <Num className="text-warn-700">({flagged.length})</Num>
            </h3>
            <p className="mt-1 text-xs2 text-ink-500">تُستورد كما هي — التنبيه لتراها، لا ليمنعها.</p>
          </div>
          <ul className="divide-y divide-ink-150">
            {flagged.slice(0, 12).map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3">
                <span className="text-body text-ink-900">{r.student.fullName}</span>
                <span className="text-micro text-ink-500">
                  {halaqaName(r.student.halaqaId)}
                  {r.student.track && <> · {TRACK_AR[r.student.track]}</>}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {r.issues.map((is) => <Chip key={is} tone="warn">{ISSUE_AR[is] ?? is}</Chip>)}
                </span>
              </li>
            ))}
          </ul>
          {flagged.length > 12 && (
            <p className="border-t border-ink-150 px-6 py-3 text-micro text-ink-500">
              وأكثر من ذلك بـ<Num>{flagged.length - 12}</Num> صفًا.
            </p>
          )}
        </Sheet>
      )}
    </div>
  );
}

function outcomeLabel(s: SheetOutcome): string {
  switch (s.kind) {
    case 'ROSTER': case 'RATEL': return `${s.roster.rows.length} طالبًا`;
    case 'QIYAS': case 'EXAMS':  return `${s.exams.rows.length} اختبارًا`;
    case 'PLAN_LOG':             return `${s.planLog.rows.length} خطة`;
    case 'CURRICULUM':           return `${new Set(s.curriculum.days.map((d) => d.level)).size} مستوى`;
    default:                     return '';
  }
}
