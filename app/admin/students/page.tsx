'use client';
/* الطلاب والحلقات — SPEC.md §6.2 (إد-٣-أ) merged with §6.3 (إد-٣-ب).
   One screen: the halaqat live in the contextual panel, the roster fills the
   work area, and selecting a halaqa turns the page into that halaqa's file. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  UploadCloud, UserPlus, Search, Pencil, ArrowLeftRight, Inbox, X,
  AlertTriangle, Users2,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, INPUT } from '@/components/ui';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { StudentDialog } from '@/components/StudentDialog';
import { MoveDialog } from '@/components/MoveDialog';
import { HalaqaDialog } from '@/components/HalaqaDialog';
import { useDB } from '@/lib/store';
import { TRACK_AR, STATUS_AR, type Student } from '@/lib/types';
import { foldArabic, shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

const TRACK_TONE = { GOLDEN: 'warn', SILVER: 'ink', TALQEEN: 'info' } as const;

function StudentsScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editStudent, setEditStudent] = useState<Student | 'new' | null>(null);
  const [editHalaqa, setEditHalaqa] = useState(false);
  const [moving, setMoving] = useState(false);

  const halaqaFilter = sp.get('halaqa');

  /* Filtering replaces the query string without unmounting this screen, so an
     open dialog would linger over the new view. Close everything on any change. */
  const filterKey = sp.toString();
  useEffect(() => {
    setEditStudent(null); setEditHalaqa(false); setMoving(false); setSel(new Set());
  }, [filterKey]);
  const halaqa = halaqaFilter && halaqaFilter !== 'none'
    ? db.halaqat.find((h) => h.id === halaqaFilter) ?? null : null;

  const rows = useMemo(() => {
    const needle = foldArabic(q);
    return db.students.filter((s) => {
      if (halaqaFilter === 'none' ? s.halaqaId : halaqaFilter ? s.halaqaId !== halaqaFilter : false) return false;
      const track = sp.get('track'); if (track && s.track !== track) return false;
      const stage = sp.get('stage'); if (stage && s.stage !== stage) return false;
      const status = sp.get('status'); if (status && s.status !== status) return false;
      if (needle && !foldArabic(s.fullName).includes(needle) && !(s.nationalId ?? '').includes(q.trim())) return false;
      return true;
    });
  }, [db.students, halaqaFilter, sp, q]);

  /* Which tracks actually appear in the selected halaqa — normally exactly one. */
  const halaqaTracks = useMemo(() => {
    if (!halaqa) return [] as [string, number][];
    const m = new Map<string, number>();
    for (const s of rows) if (s.track) m.set(s.track, (m.get(s.track) ?? 0) + 1);
    return [...m.entries()];
  }, [halaqa, rows]);

  const halaqaName = (id: string | null) => {
    const t = id ? db.halaqat.find((h) => h.id === id)?.teacher : null;
    return t ? shortName(t) : '—';
  };

  const toggle = (id: string) =>
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (!db.students.length) {
    return (
      <>
        <TopBar title="الطلاب والحلقات" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="القائمة فارغة"
              body="ارفع تقرير رتل أو قاعدة بيانات الطلاب. النظام يقرأ الأعمدة بنفسه، ويعرض معاينة كاملة قبل أن يحفظ شيئًا."
              action={<Link href="/admin/students/import">
                <Btn variant="primary" size="lg" icon={UploadCloud}>رفع ملف</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="الطلاب والحلقات"
        crumbs={halaqa ? [`حلقة ${halaqa.teacher}`] : undefined}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/students/import"><Btn icon={UploadCloud}>رفع ملف</Btn></Link>
            <Btn variant="primary" icon={UserPlus} onClick={() => setEditStudent('new')}>إضافة طالب</Btn>
          </div>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        {/* ── halaqa file header — the page becomes that halaqa's record ──── */}
        {halaqa && (
          <Sheet className="rise mb-4 border-brand-200 bg-brand-50/50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-micro uppercase tracking-[.12em] text-brand-800">حلقة</p>
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-t1 text-ink-900">{halaqa.teacher}</h2>
                  {/* a halaqa is normally one track — show it here instead of on every row */}
                  {halaqaTracks.map(([t, n]) => (
                    <Chip key={t} tone={TRACK_TONE[t as keyof typeof TRACK_TONE]}>
                      {TRACK_AR[t as keyof typeof TRACK_AR]}
                      {halaqaTracks.length > 1 && <> <Num>{n}</Num></>}
                    </Chip>
                  ))}
                </div>
                <p className="mt-1.5 text-panel text-ink-600">
                  {/* the name already carries the time slot — don't say it twice */}
                  {halaqa.name}{halaqa.name.includes(halaqa.timeSlot) ? '' : ` · ${halaqa.timeSlot}`}
                </p>
                {halaqa.notes && <p className="mt-1 text-panel text-ink-500">{halaqa.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-paper px-3 py-2 text-center">
                  <span className="block font-display text-t1 text-ink-900"><Num>{rows.length}</Num></span>
                  <span className="block text-micro text-ink-500">طالبًا</span>
                </span>
                <Btn icon={Pencil} onClick={() => setEditHalaqa(true)}>تعديل الحلقة</Btn>
              </div>
            </div>
          </Sheet>
        )}
        {halaqaFilter === 'none' && (
          <div className="rise mb-4 flex items-start gap-3 rounded-xl border border-risk-200 bg-risk-100 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-risk-700" />
            <p className="text-base2 text-risk-700">
              هؤلاء طلاب بلا حلقة. حدّدهم وانقلهم إلى حلقة حتى يختفي التنبيه من الرئيسية.
            </p>
          </div>
        )}

        {/* ── search + bulk bar ──────────────────────────────────────────── */}
        <div className="rise mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search size={16} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهوية…" className={cx(INPUT, 'pe-10')} />
          </div>
          <span className="text-panel text-ink-500">
            <Num className="font-medium text-ink-900">{rows.length}</Num> من <Num>{db.students.length}</Num>
          </span>
          {sel.size > 0 && (
            <div className="fade flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5">
              <span className="text-panel text-brand-800">حُدِّد <Num>{sel.size}</Num></span>
              <Btn size="sm" icon={ArrowLeftRight} onClick={() => setMoving(true)}>نقل إلى حلقة</Btn>
              <button onClick={() => setSel(new Set())} className="rounded p-1 text-ink-400 hover:text-ink-800"><X size={14} /></button>
            </div>
          )}
        </div>

        {/* ── roster ─────────────────────────────────────────────────────── */}
        <Sheet className="rise" pad={false}>
          {rows.length === 0 ? (
            <Empty icon={Users2} title="لا نتائج" body="جرّب توسيع التصفية أو مسح البحث." />
          ) : (
            <div className="overflow-x-auto">
              <table className={cx('w-full border-collapse text-body', halaqa ? 'min-w-[44rem]' : 'min-w-[56rem]')}>
                <thead>
                  <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" aria-label="تحديد الكل"
                        checked={sel.size === rows.length && rows.length > 0}
                        onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                        className="h-4 w-4 rounded-sm border-ink-300 accent-brand-800" />
                    </th>
                    {['الطالب', 'رقم الهوية',
                      ...(halaqa ? [] : ['المسار', 'الحلقة']),
                      'المستوى', 'الصف', 'الجنسية', 'جوال ولي الأمر', ''].map((h) => (
                      <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}
                      className={cx('border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50',
                        sel.has(s.id) && 'bg-brand-50')}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)}
                          aria-label={`تحديد ${s.fullName}`}
                          className="h-4 w-4 rounded-sm border-ink-300 accent-brand-800" />
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium text-ink-900">{s.fullName}</span>
                        {/* a column identical on every row carries nothing; the exception does */}
                        {s.status !== 'ACTIVE' && (
                          <Chip tone={s.status === 'INACTIVE' ? 'risk' : 'brand'}>{STATUS_AR[s.status]}</Chip>
                        )}
                        {s.nationalIdFlag && (
                          <Chip tone="warn"><AlertTriangle size={10} />
                            {s.nationalIdFlag === 'DUPLICATE' ? 'رقم مكرّر' : s.nationalIdFlag === 'SHORT' ? 'رقم قصير' : 'رقم طويل'}
                          </Chip>)}
                      </td>
                      <td className="px-3 py-3"><Num className="text-panel text-ink-700">{s.nationalId ?? '—'}</Num></td>
                      {!halaqa && (
                        <>
                          <td className="px-3 py-3">
                            {s.track ? <Chip tone={TRACK_TONE[s.track]}>{TRACK_AR[s.track]}</Chip> : <span className="text-ink-400">—</span>}
                          </td>
                          <td className="px-3 py-3 text-panel text-ink-600"
                              title={db.halaqat.find((h) => h.id === s.halaqaId)?.teacher}>
                            {halaqaName(s.halaqaId)}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-3">
                        {s.currentLevel != null
                          ? <Num className="text-panel font-medium text-ink-800">{s.currentLevel}</Num>
                          : <span className="text-micro text-ink-400">—</span>}
                      </td>
                      <td className="px-3 py-3 text-panel text-ink-600">{s.grade || '—'}</td>
                      <td className="px-3 py-3 text-panel text-ink-600">{s.nationality || '—'}</td>
                      <td className="px-3 py-3"><Num className="text-panel text-ink-700">{s.guardianPhone || '—'}</Num></td>
                      <td className="px-3 py-3 text-end">
                        <button onClick={() => setEditStudent(s)} aria-label={`تعديل ${s.fullName}`}
                          className="rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900">
                          <Pencil size={14} strokeWidth={1.9} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Sheet>
      </div>

      <StudentDialog open={editStudent !== null} student={editStudent === 'new' ? null : editStudent}
        defaultHalaqa={halaqa?.id ?? null} onClose={() => setEditStudent(null)} />
      <HalaqaDialog open={editHalaqa} halaqa={halaqa} onClose={() => setEditHalaqa(false)} />
      <MoveDialog open={moving} ids={[...sel]} onClose={() => { setMoving(false); setSel(new Set()); }} />
    </>
  );
}

export default function Page() {
  return <Suspense><StudentsScreen /></Suspense>;
}
