'use client';
/* رفع الملفات — SPEC.md §5.
   One surface, many files, five shapes. Each file is classified from its own
   headers instead of asking the supervisor to pick. parse → classify → PREVIEW
   → commit. Nothing is written before confirming, and an import never deletes. */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft,
  Loader2, XCircle, Info, X, ChevronLeft,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty } from '@/components/ui';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { scanWorkbook, KIND_AR, KIND_TARGET, type SheetScan, type FileKind } from '@/lib/importers/detect';
import { parseRoster, ISSUE_AR, type ParseResult } from '@/lib/importers/roster';
import { buildPlan, COLUMN_DESTINATION, DEST_LABEL, type ImportPlan, type DestGroup } from '@/lib/importers/plan';
import { useDB } from '@/lib/store';
import { shortName } from '@/lib/normalise';
import { store } from '@/lib/store';
import { TRACK_AR } from '@/lib/types';
import { cx } from '@/lib/cx';

const COL_AR: Record<string, string> = {
  name: 'اسم الطالب', nationalId: 'رقم الهوية', track: 'المسار', halaqa: 'الحلقة',
  grade: 'الصف', stage: 'المرحلة', nationality: 'الجنسية', phone: 'جوال ولي الأمر',
  mosque: 'المسجد', attended: 'الحضور', hifzPages: 'الحفظ بالأوجه',
  reviewPages: 'المراجعة بالأوجه', hifzTeacher: 'معلم الحفظ',
};

/* Roster before Ratel: the roster establishes identity and «المسار», the Ratel
   report layers the weekly snapshot on top. Merging never blanks, so this is
   belt-and-braces rather than strictly required. */
const ORDER: FileKind[] = ['ROSTER', 'RATEL', 'PLAN_LOG', 'EXAMS', 'QIYAS', 'CURRICULUM', 'UNKNOWN'];

type Job = {
  id: string;
  name: string;
  wb: XLSX.WorkBook;
  scans: SheetScan[];
  chosen: SheetScan | null;
  result: ParseResult | null;
  error?: string;
};

const supported = (k?: FileKind) => k === 'RATEL' || k === 'ROSTER';
const uid = () => Math.random().toString(36).slice(2, 9);

export default function ImportPage() {
  const { panelOpen, setPanelOpen } = usePanel();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState<{ students: number; halaqat: number; files: number } | null>(null);
  const [error, setError] = useState('');
  const db = useDB();

  const buildJob = (name: string, wb: XLSX.WorkBook): Job => {
    const scans = scanWorkbook(wb);
    const candidates = scans.filter((s) => supported(s.kind));
    let chosen: SheetScan | null = candidates[0] ?? scans[0] ?? null;
    let bestScore = -1;
    for (const c of candidates) {
      const score = Object.keys(parseRoster(wb, c.sheet).columnMap).length;
      if (score > bestScore) { bestScore = score; chosen = c; }
    }
    return {
      id: uid(), name, wb, scans, chosen,
      result: chosen && supported(chosen.kind) ? parseRoster(wb, chosen.sheet) : null,
      error: scans.length ? undefined : 'لم نتعرّف على شكل هذا الملف',
    };
  };

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const files = [...list].filter((f) => /\.xlsx?$/i.test(f.name));
    if (!files.length) { setError('اختر ملفات إكسل بصيغة ‎.xlsx‎'); return; }
    setError(''); setBusy(true); setDone(null);
    const next: Job[] = [];
    for (const f of files) {
      try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
        next.push(buildJob(f.name, wb));
      } catch {
        next.push({ id: uid(), name: f.name, wb: null as never, scans: [], chosen: null, result: null,
                    error: 'تعذّر فتح الملف — تأكّد أنه إكسل صالح' });
      }
    }
    setJobs((p) => [...p, ...next]);
    setOpenId((p) => p ?? next.find((j) => j.result)?.id ?? null);
    setBusy(false);
  }, []);

  const pickSheet = (jobId: string, s: SheetScan) =>
    setJobs((p) => p.map((j) => j.id !== jobId ? j : {
      ...j, chosen: s, result: supported(s.kind) ? parseRoster(j.wb, s.sheet) : null,
    }));

  const remove = (id: string) => {
    setJobs((p) => p.filter((j) => j.id !== id));
    setOpenId((p) => (p === id ? null : p));
  };

  const ready = jobs.filter((j) => j.result);
  const totals = useMemo(() => ({
    students: ready.reduce((n, j) => n + (j.result?.rows.length ?? 0), 0),
    review: ready.reduce((n, j) => n + (j.result?.rows.filter((r) => r.issues.length).length ?? 0), 0),
    skipped: ready.reduce((n, j) => n + (j.result?.skipped.length ?? 0), 0),
    halaqat: new Set(ready.flatMap((j) => j.result?.halaqat.map((h) => h.name) ?? [])).size,
  }), [ready]);

  const [committing, setCommitting] = useState(false);
  const [commitErr, setCommitErr] = useState('');

  const commit = async () => {
    setCommitting(true); setCommitErr('');
    /* Roster before Ratel: the roster establishes identity and «المسار», the
       Ratel report layers the weekly snapshot on top. */
    const sorted = [...ready].sort(
      (a, b) => ORDER.indexOf(a.chosen?.kind ?? 'UNKNOWN') - ORDER.indexOf(b.chosen?.kind ?? 'UNKNOWN'));
    try {
      let created = 0, updated = 0;
      for (const j of sorted) {
        const r = await store.commitImport({
          students: j.result!.rows.map((x) => x.student),
          halaqat: j.result!.halaqat,
          fileName: j.name,
          sheetName: j.chosen?.sheet ?? '',
          kind: j.chosen?.kind ?? 'UNKNOWN',
        });
        created += r.created ?? 0; updated += r.updated ?? 0;
      }
      setDone({ students: created + updated, halaqat: totals.halaqat, files: sorted.length });
    } catch (e) {
      setCommitErr(e instanceof Error ? e.message : 'تعذّر الاستيراد');
    } finally { setCommitting(false); }
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
              body={`من ${done.files} ${done.files === 1 ? 'ملف' : 'ملفات'}: ${done.students} طالبًا و${done.halaqat} حلقات.`}
              action={<div className="flex gap-2">
                <Btn onClick={() => { setJobs([]); setDone(null); }}>رفع ملفات أخرى</Btn>
                <Btn variant="primary" size="lg" onClick={() => router.push('/admin/students')}>
                  <ArrowLeft size={16} /> عرض الطلاب والحلقات</Btn>
              </div>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="رفع الملفات" crumbs={['الطلاب والحلقات']} panelOpen={panelOpen}
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
            اسحب ملفًا واحدًا أو عدة ملفات معًا. النظام يقرأ عناوين الأعمدة ويتعرّف على نوع كل ملف بنفسه —
            لا تحتاج أن تخبره. ولن يُحفظ شيء قبل أن تراجع المعاينة وتضغط «اعتماد».
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
            <Loader2 size={17} className="animate-spin text-brand-700" /> جارٍ قراءة الملفات…
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
              <p className="mt-1 text-xs2 text-ink-500">اضغط ملفًا لتفحص معاينته</p>
            </div>
            <ul className="divide-y divide-ink-150">
              {jobs.map((j) => {
                const kind = j.chosen?.kind;
                const rows = j.result?.rows.length ?? 0;
                const rev = j.result?.rows.filter((r) => r.issues.length).length ?? 0;
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
                            {j.error ? j.error
                              : `${KIND_AR[kind ?? 'UNKNOWN']} · ${j.chosen?.sheet ?? ''}`}
                          </span>
                        </span>
                        {j.result && <Chip tone="ok"><Num>{rows}</Num> طالبًا</Chip>}
                        {rev > 0 && <Chip tone="warn"><Num>{rev}</Num> للمراجعة</Chip>}
                        {!j.result && !j.error && <Chip tone="ink">لم يُبنَ مستورده</Chip>}
                        {j.error && <Chip tone="risk">تعذّر</Chip>}
                        <ChevronLeft size={15} className={cx('shrink-0 text-ink-400 transition-transform',
                          openId === j.id && '-rotate-90')} />
                      </button>
                      <button onClick={() => remove(j.id)} aria-label={`إزالة ${j.name}`}
                        className="shrink-0 rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-risk-700">
                        <X size={15} />
                      </button>
                    </div>

                    {/* sheet picker — a workbook often holds several usable sheets */}
                    {openId === j.id && j.scans.length > 1 && (
                      <div className="fade border-t border-ink-150 bg-page/40 px-6 py-3.5">
                        <p className="mb-2 text-micro text-ink-500">
                          أوراق هذا الملف — اخترنا التي تحمل أكثر الأعمدة. تستطيع استيراد ورقة أخرى بعدها؛ الدمج يضيف ولا يمسح.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {j.scans.map((s) => (
                            <button key={s.sheet} onClick={() => pickSheet(j.id, s)}
                              className={cx('rounded-lg border px-3 py-2 text-start transition-colors',
                                j.chosen?.sheet === s.sheet ? 'border-brand-700 bg-brand-50' : 'border-ink-200 bg-paper hover:border-ink-300',
                                !supported(s.kind) && 'opacity-60')}>
                              <span className="block text-panel font-medium text-ink-900">{s.sheet}</span>
                              <span className="block text-micro text-ink-500">
                                {KIND_AR[s.kind]} · <Num>{s.dataRows}</Num> صفًا
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Sheet>
        )}

        {/* ── preview of the opened file ─────────────────────────────────── */}
        {open && open.result && <FilePreview job={open} />}
        {open && !open.result && !open.error && (
          <Sheet className="rise mt-4">
            <Empty icon={AlertTriangle}
              title={`«${KIND_AR[open.chosen?.kind ?? 'UNKNOWN']}» لم يُبنَ مستورده بعد`}
              body="بُني حتى الآن مستورد رتل وقاعدة الطلاب. البقية تأتي بالترتيب في خطة البناء — وحتى ذلك الحين يتجاهلها الاستيراد بدل أن يدّعي." />
          </Sheet>
        )}

        {commitErr && (
          <div className="rise mt-4 flex items-start gap-3 rounded-xl border border-risk-200 bg-risk-100 p-4">
            <XCircle size={18} className="mt-0.5 shrink-0 text-risk-700" />
            <p className="text-base2 text-risk-700">{commitErr}</p>
          </div>
        )}

        {/* ── commit bar ─────────────────────────────────────────────────── */}
        {ready.length > 0 && (
          <div className="rise sticky bottom-0 -mx-6 mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ink-150 bg-page/90 px-6 py-4 backdrop-blur-md">
            <p className="text-panel text-ink-600">
              من <Num className="font-medium text-ink-900">{ready.length}</Num> {ready.length === 1 ? 'ملف' : 'ملفات'}:
              {' '}<Num className="font-medium text-ink-900">{totals.students}</Num> صفًا
              و<Num className="font-medium text-ink-900">{totals.halaqat}</Num> حلقات
              {totals.review > 0 && <> · <Num className="font-medium text-warn-700">{totals.review}</Num> تحتاج مراجعتك</>}
              . الاستيراد يضيف ويحدّث فقط — <strong>لا يحذف أحدًا ولا يمسح حقلًا لا يحمله الملف</strong>.
            </p>
            <Btn variant="primary" size="lg" onClick={commit} disabled={committing}>
              {committing ? <><Loader2 size={17} className="animate-spin" />جارٍ الحفظ…</> : 'اعتماد الاستيراد'}
            </Btn>
          </div>
        )}
      </div>
    </>
  );
}

/* ── per-file preview ──────────────────────────────────────────────────── */
function FilePreview({ job }: { job: Job }) {
  const r = job.result!;
  const db = useDB();
  const review = r.rows.filter((x) => x.issues.length);

  const label = (id: string | null) => {
    if (!id) return '— بلا حلقة —';
    const inFile = r.halaqat.find((h) => h.id === id);
    if (inFile) return shortName(inFile.teacher);
    const known = db.halaqat.find((h) => h.id === id);
    return known ? shortName(known.teacher) : '—';
  };

  const plan: ImportPlan = useMemo(
    () => buildPlan(r.rows, r.halaqat, db.students, db.halaqat, label),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r, db.students, db.halaqat]);

  const changed = plan.rows.filter((p) => p.kind === 'UPDATE');

  return (
    <div className="fade mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: 'طلاب جدد', v: plan.creates },
          { l: 'ستُحدَّث بياناتهم', v: plan.updates },
          { l: 'بلا تغيير', v: plan.unchanged },
          { l: 'تحتاج مراجعتك', v: review.length },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-ink-150 bg-paper p-4">
            <p className="text-xs2 text-ink-600">{k.l}</p>
            <p className="mt-1.5 font-display text-d2 text-ink-900"><Num>{k.v}</Num></p>
          </div>
        ))}
      </div>

      {/* what a second upload actually changes — field by field */}
      {changed.length > 0 && (
        <Sheet className="border-brand-200">
          <SheetHead title="ما سيتغيّر"
            meta="هذه هي الحقول التي يحملها الملف وتختلف عمّا في القاعدة — وما عداها يبقى كما هو" />
          <ul className="divide-y divide-ink-150">
            {changed.slice(0, 25).map((p) => (
              <li key={p.row.rowNumber} className="py-3">
                <p className="text-body font-medium text-ink-900">{p.row.student.fullName}</p>
                <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                  {p.changes.map((c) => (
                    <li key={c.field} className="text-panel text-ink-600">
                      <span className="text-ink-500">{c.label}:</span>{' '}
                      <span className="text-risk-700 line-through decoration-risk-300">{c.from}</span>
                      <span className="mx-1 text-ink-400">←</span>
                      <span className="font-medium text-ok-700">{c.to}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {changed.length > 25 && (
            <p className="mt-3 text-micro text-ink-500">
              وبقيّة <Num>{changed.length - 25}</Num> طالبًا بالتغييرات نفسها في الحقول المذكورة.
            </p>
          )}
        </Sheet>
      )}

      {/* present in the database, absent from this file — never deleted */}
      {plan.missing.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-warn-200 bg-warn-100/50 p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn-700" />
          <div>
            <p className="text-body font-medium text-ink-900">
              <Num>{plan.missing.length}</Num> طالبًا في القاعدة وليسوا في هذا الملف
            </p>
            <p className="mt-1 text-panel text-ink-600">
              لن يُحذف أحد منهم. الاستيراد يضيف ويحدّث فقط — فإن كان أحدهم انقطع فعلًا،
              علّمه «منقطعًا» بنفسك من صفحة الطلاب.
            </p>
            <p className="mt-2 text-panel text-ink-500">
              {plan.missing.slice(0, 5).map((s) => s.fullName).join('، ')}
              {plan.missing.length > 5 && ` وغيرهم`}
            </p>
          </div>
        </div>
      )}

      {r.skipped.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-ink-200 bg-paper p-4">
          <Info size={17} className="mt-0.5 shrink-0 text-ink-500" />
          <p className="text-panel text-ink-600">
            تجاوزنا <Num className="font-medium text-ink-900">{r.skipped.length}</Num> صفًا ليست طلابًا:{' '}
            {r.skipped.slice(0, 3).map((s) => `«${s.raw}»`).join('، ')}{r.skipped.length > 3 && ' وغيرها'}.
          </p>
        </div>
      )}

      <Sheet>
        <SheetHead title="أين تذهب كل معلومة"
          meta="ملف واحد قد يخدم أكثر من غرض — هذا تفصيل ما يذهب إلى أين" />
        <div className="space-y-3">
          {(['STUDENT', 'HALAQA', 'SNAPSHOT'] as DestGroup[]).map((g) => {
            const cols = Object.keys(r.columnMap).filter((k) => COLUMN_DESTINATION[k]?.group === g);
            if (!cols.length) return null;
            return (
              <div key={g} className="flex flex-wrap items-baseline gap-2">
                <span className="w-40 shrink-0 text-panel font-medium text-ink-800">{DEST_LABEL[g]}</span>
                <span className="flex flex-wrap gap-1.5">
                  {cols.map((k) => <Chip key={k} tone="ok">{COLUMN_DESTINATION[k].label}</Chip>)}
                </span>
              </div>
            );
          })}
          {r.unmappedHeaders.filter((h) => h && !/^\w{3} \w{3} \d/.test(h)).length > 0 && (
            <div className="flex flex-wrap items-baseline gap-2 border-t border-ink-150 pt-3">
              <span className="w-40 shrink-0 text-panel font-medium text-ink-500">لا يحتاجها النظام</span>
              <span className="flex flex-wrap gap-1.5">
                {r.unmappedHeaders.filter((h) => h && !/^\w{3} \w{3} \d/.test(h)).slice(0, 10)
                  .map((h, i) => <Chip key={`${h}-${i}`} tone="ink">{h}</Chip>)}
              </span>
            </div>
          )}
        </div>
      </Sheet>

      {review.length > 0 && (
        <Sheet className="border-warn-200">
          <SheetHead title="صفوف تحتاج مراجعتك"
            meta="تُستورد كما هي — نعرضها عليك لتصحّحها لاحقًا، ولا نخمّن نيابةً عنك" />
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-panel">
              <thead>
                <tr className="border-b border-ink-200 text-cap text-ink-500">
                  {['الصف', 'الطالب', 'رقم الهوية', 'الملاحظة'].map((h) => (
                    <th key={h} className="px-2 pb-2 text-start font-medium">{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {review.map((x) => (
                  <tr key={x.rowNumber} className="border-b border-ink-150 last:border-0">
                    <td className="px-2 py-2.5 text-ink-500"><Num>{x.rowNumber}</Num></td>
                    <td className="px-2 py-2.5 text-ink-900">{x.student.fullName}</td>
                    <td className="px-2 py-2.5"><Num className="text-ink-700">{x.student.nationalId ?? '—'}</Num></td>
                    <td className="px-2 py-2.5">
                      <span className="flex flex-wrap gap-1">
                        {x.issues.map((i) => <Chip key={i} tone="warn">{ISSUE_AR[i]}</Chip>)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sheet>
      )}

      <Sheet>
        <SheetHead title="الحلقات"
          meta={plan.newHalaqat.length
            ? `${plan.newHalaqat.length} حلقة جديدة · ${plan.knownHalaqat.length} موجودة مسبقًا`
            : 'كلها موجودة مسبقًا — لن تُنشأ حلقة جديدة'} />
        <div className="grid gap-2 sm:grid-cols-2">
          {r.halaqat.map((h) => {
            const isNew = plan.newHalaqat.some((n) => n.name === h.name);
            return (
              <div key={h.id} className={cx('rounded-lg border p-3',
                isNew ? 'border-brand-200 bg-brand-50' : 'border-ink-150 bg-page/50')}>
                <p className="flex items-center gap-2 text-body font-medium text-ink-900">
                  {shortName(h.teacher)}
                  {isNew && <Chip tone="brand">جديدة</Chip>}
                </p>
                <p className="mt-0.5 text-micro text-ink-500">
                  {h.timeSlot} · <Num>{r.rows.filter((x) => x.halaqaName === h.name).length}</Num> طالبًا
                </p>
              </div>
            );
          })}
        </div>
      </Sheet>

      <Sheet>
        <SheetHead title="معاينة الطلاب" meta={`أول ١٢ صفًا من ${r.rows.length}`} />
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-panel">
            <thead>
              <tr className="border-b border-ink-200 text-cap text-ink-500">
                {['الطالب', 'رقم الهوية', 'المسار', 'الحلقة', 'الصف', 'الجنسية', 'جوال ولي الأمر'].map((h) => (
                  <th key={h} className="px-2 pb-2 text-start font-medium">{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {r.rows.slice(0, 12).map((x) => (
                <tr key={x.rowNumber} className="border-b border-ink-150 last:border-0">
                  <td className="px-2 py-2.5 text-ink-900">{x.student.fullName}</td>
                  <td className="px-2 py-2.5"><Num className="text-ink-700">{x.student.nationalId ?? '—'}</Num></td>
                  <td className="px-2 py-2.5 text-ink-700">{x.student.track ? TRACK_AR[x.student.track] : '—'}</td>
                  <td className="px-2 py-2.5 text-ink-600">{x.halaqaName || '—'}</td>
                  <td className="px-2 py-2.5 text-ink-600">{x.student.grade || '—'}</td>
                  <td className="px-2 py-2.5 text-ink-600">{x.student.nationality || '—'}</td>
                  <td className="px-2 py-2.5"><Num className="text-ink-700">{x.student.guardianPhone || '—'}</Num></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sheet>
    </div>
  );
}
