'use client';
/* الطلاب والحلقات — SPEC.md §6.2 (إد-٣-أ) merged with §6.3 (إد-٣-ب).
   One screen: the halaqat live in the contextual panel, the roster fills the
   work area, and selecting a halaqa turns the page into that halaqa's file. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  UserPlus, Search, Pencil, Inbox, X,
  AlertTriangle, Users2, Home } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, INPUT } from '@/components/ui';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { StudentDialog } from '@/components/StudentDialog';
import { HalaqaDialog } from '@/components/HalaqaDialog';
import { useDB } from '@/lib/store';
import { TRACK_AR, STATUS_AR, type Student } from '@/lib/types';
import { foldArabic, shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';
import { StudentProfile } from '@/components/StudentProfile';

const TRACK_TONE = { GOLDEN: 'warn', SILVER: 'ink', TALQEEN: 'info' } as const;

function StudentsScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [editStudent, setEditStudent] = useState<Student | 'new' | null>(null);
  const [editHalaqa, setEditHalaqa] = useState(false);
  /* بالمعرّف لا بالكائن: الطالب يُعدَّل من داخل ملفه، والكائن المحفوظ في الحالة
     يصير نسخةً قديمة في اللحظة التي يُحفظ فيها أوّل سطر. */
  const [profile, setProfile] = useState<string | null>(null);
  const halaqaFilter = sp.get('halaqa');
  /* `?student=` يفتح ملفه مباشرة — تأتي كشوف المتابعة بهذا الرابط، فصفّ
     «جاهزون للجمعية» يفتح الطالب حيث تُعدَّل بياناته لا حيث تُقرأ فقط. */
  const askedStudent = sp.get('student');

  /* Filtering replaces the query string without unmounting this screen, so an
     open dialog would linger over the new view. Close everything on any change. */
  /* `student` مستثنى: تغيّره يفتح ملفًّا، وإقفال الملف فور فتحه يجعل
     الرابط القادم من كشوف المتابعة لا يصل. */
  const filterKey = (() => {
    const q = new URLSearchParams(sp.toString());
    q.delete('student');
    return q.toString();
  })();
  useEffect(() => {
    setEditStudent(null); setEditHalaqa(false);
    setProfile(null);
  }, [filterKey]);
  useEffect(() => { if (askedStudent) setProfile(askedStudent); }, [askedStudent]);
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

  /* Which tracks actually appear in the selected halaqa. A halaqa is not tied
     to one: its students each carry their own, so this may well be several.
     Counted over ALL its students, not `rows` — the header card describes the
     halaqa, and must not shrink when a track filter is on. */
  const halaqaTracks = useMemo(() => {
    if (!halaqa) return [] as [string, number][];
    const m = new Map<string, number>();
    for (const s of db.students) {
      if (s.halaqaId === halaqa.id && s.track) m.set(s.track, (m.get(s.track) ?? 0) + 1);
    }
    return (['GOLDEN', 'SILVER', 'TALQEEN'] as const)
      .filter((t) => m.has(t)).map((t) => [t as string, m.get(t)!] as [string, number]);
  }, [halaqa, db.students]);

  /* The halaqa's own size, for the same reason the chips beside it are counted
     that way: the card is the halaqa's file, not a description of whatever is
     left after the other filters. It read `rows.length` before, so a narrowing
     filter made a halaqa of thirteen announce «٠ طالبًا» beside a chip saying
     thirteen — two numbers for one fact, and the wrong one in the larger type. */
  const halaqaTotal = useMemo(
    () => (halaqa ? db.students.filter((s) => s.halaqaId === halaqa.id).length : 0),
    [halaqa, db.students]);

  /* Every filter that is on, named. The roster is filtered by the query string,
     and the panel that sets it scrolls: a track or a stage chosen earlier stays
     on while its chip is out of view, so «لا نتائج» arrived with no visible
     cause. Naming them here — beside the count and again in the empty state —
     is what turns a dead end into something the supervisor can undo. */
  const activeFilters = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const track = sp.get('track');
    if (track) out.push({ key: 'track', label: `المسار: ${TRACK_AR[track as keyof typeof TRACK_AR] ?? track}` });
    const stage = sp.get('stage');
    if (stage) out.push({ key: 'stage', label: `المرحلة: ${stage}` });
    const status = sp.get('status');
    if (status) out.push({ key: 'status', label: `الحالة: ${STATUS_AR[status as keyof typeof STATUS_AR] ?? status}` });
    return out;
  }, [sp]);

  /** Drop one filter, or all of them, keeping the halaqa the screen is showing. */
  const clearFilters = (key?: string) => {
    const next = new URLSearchParams(sp.toString());
    if (key) next.delete(key);
    else for (const f of activeFilters) next.delete(f.key);
    router.replace(`/admin/students${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const halaqaName = (id: string | null) => {
    const t = id ? db.halaqat.find((h) => h.id === id)?.teacher : null;
    return t ? shortName(t) : '—';
  };

  if (!db.students.length) {
    return (
      <>
        <TopBar title="الطلاب والحلقات" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="القائمة فارغة"
              body="القوائم تُبنى من ملفاتك، والرفع مكانه الصفحة الرئيسية وحدها — ترفع مرة واحدة هناك فتمتلئ هذه الشاشة وبقيّة الشاشات معها."
              action={<Link href="/admin">
                <Btn variant="primary" size="lg" icon={Home}>الصفحة الرئيسية</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  /* من الحالة لا من الصفّ: الطالب يُعدَّل من داخل ملفه، فالكائن يُقرأ من المخزن
     في كل رسم ليعكس ما حُفظ للتوّ. */
  const opened = profile ? db.students.find((x) => x.id === profile) ?? null : null;

  if (opened) {
    return (
      <>
        <TopBar title="الطلاب والحلقات" crumbs={[opened.fullName]}
          panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8 pb-16">
          <StudentProfile student={opened} onClose={() => setProfile(null)}
            onFullEdit={() => setEditStudent(opened)} />
        </div>
        {editStudent && (
          <StudentDialog open student={editStudent === 'new' ? null : editStudent}
            defaultHalaqa={halaqa?.id ?? null} onClose={() => setEditStudent(null)} />
        )}
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
                  {/* the mix the halaqa actually holds, counted — never a single
                      label, since its students may sit on different tracks */}
                  {halaqaTracks.map(([t, n]) => (
                    <Chip key={t} tone={TRACK_TONE[t as keyof typeof TRACK_TONE]}>
                      {TRACK_AR[t as keyof typeof TRACK_AR]} <Num>{n}</Num>
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
                  <span className="block font-display text-t1 text-ink-900"><Num>{halaqaTotal}</Num></span>
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
            <Num className="font-medium text-ink-900">{rows.length}</Num> من{' '}
            <Num>{halaqa ? halaqaTotal : db.students.length}</Num>
          </span>

          {/* The filters that are narrowing the list, each one removable where
              the result of it is being read. */}
          {activeFilters.map((f) => (
            <button key={f.key} onClick={() => clearFilters(f.key)}
              title={`إزالة تصفية ${f.label}`}
              className="fade group flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 py-1.5 pe-2 ps-3 text-panel text-brand-800 transition-colors hover:border-risk-200 hover:bg-risk-100 hover:text-risk-700">
              {f.label}
              <X size={13} className="opacity-60 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>

        {/* ── roster ─────────────────────────────────────────────────────── */}
        <Sheet className="rise" pad={false}>
          {rows.length === 0 ? (
            /* Say what is hiding them, and offer to stop it. A halaqa that holds
               students but shows none is otherwise indistinguishable from an
               empty one, and the cause was a chip scrolled out of sight. */
            <Empty icon={Users2} title="لا نتائج"
              body={activeFilters.length > 0
                ? `${halaqa ? `في هذه الحلقة ${halaqaTotal} طالبًا، لكن ` : ''}التصفية الحالية تُخفيهم — ${activeFilters.map((f) => f.label).join(' · ')}${q.trim() ? ` · البحث: ${q.trim()}` : ''}.`
                : q.trim()
                  ? 'لا اسم ولا رقم هوية يطابق بحثك.'
                  : halaqa ? 'لا طلاب في هذه الحلقة بعد.' : 'لا طلاب بعد.'}
              action={activeFilters.length > 0
                ? <Btn variant="primary" icon={X} onClick={() => clearFilters()}>امسح التصفية</Btn>
                : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <table className={cx('w-full border-collapse text-body', halaqa ? 'min-w-[48rem]' : 'min-w-[56rem]')}>
                <thead>
                  <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                    {/* لا مربّع تحديد ولا عمود قلم: الصفّ كلّه يفتح ملف الطالب،
                        وفيه يُعدَّل كل شيء — ومنه نقله إلى حلقة أخرى. */}
                    {['الطالب', 'رقم الهوية', 'المسار',
                      ...(halaqa ? [] : ['الحلقة']),
                      'المستوى', 'الصف', 'الجنسية', 'جوال ولي الأمر'].map((h) => (
                      <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} onClick={() => setProfile(s.id)}
                      tabIndex={0} role="button"
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProfile(s.id); } }}
                      aria-label={`ملف ${s.fullName}`}
                      className="cursor-pointer border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50 focus:bg-brand-50 focus:outline-none">
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
                      {/* the track is the student's own, so it stays even inside
                          a halaqa — its rows no longer all carry the same one */}
                      <td className="px-3 py-3">
                        {s.track ? <Chip tone={TRACK_TONE[s.track]}>{TRACK_AR[s.track]}</Chip> : <span className="text-ink-400">—</span>}
                      </td>
                      {!halaqa && (
                        <td className="px-3 py-3 text-panel text-ink-600"
                            title={db.halaqat.find((h) => h.id === s.halaqaId)?.teacher}>
                          {halaqaName(s.halaqaId)}
                        </td>
                      )}
                      <td className="px-3 py-3">
                        {s.currentLevel != null
                          ? <Num className="text-panel font-medium text-ink-800">{s.currentLevel}</Num>
                          : <span className="text-micro text-ink-400">—</span>}
                      </td>
                      <td className="px-3 py-3 text-panel text-ink-600">{s.grade || '—'}</td>
                      <td className="px-3 py-3 text-panel text-ink-600">{s.nationality || '—'}</td>
                      <td className="px-3 py-3"><Num className="text-panel text-ink-700">{s.guardianPhone || '—'}</Num></td>
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
    </>
  );
}

export default function Page() {
  return <Suspense><StudentsScreen /></Suspense>;
}
