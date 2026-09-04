'use client';
/* الخطط — two jobs that look alike and are not. Printing a sheet writes a date
   against ONE student; editing a level rewrites the curriculum «لكل من يأخذ هذا
   المستوى». They belong side by side so the supervisor can move between them,
   and labelled apart so he never edits the master thinking he edited a sheet. */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { Num } from '@/components/Num';
import { useDB } from '@/lib/store';
import { coverage } from '@/lib/curriculum';
import { TRACK_AR, type Track } from '@/lib/types';

export function PlansPanel({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const path = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const onPrint = path === '/admin/plans';
  const onLevels = path.startsWith('/admin/plans/levels');
  const onCurriculum = path.startsWith('/admin/plans/curriculum');

  const cover = coverage(db.curriculum);

  /* Counted from the roster itself. Seventy-two names in one list make the
     eleven golden ones impossible to find — and if the count here reads zero,
     the file is what is missing, not the screen. */
  const TRACKS: Track[] = ['SILVER', 'GOLDEN'];
  const byTrack = (t: Track) => db.students.filter((s) => s.track === t).length;
  const picked = sp.get('track');
  const setTrack = (t: Track | null) => {
    const p = new URLSearchParams(sp.toString());
    if (t) p.set('track', t); else p.delete('track');
    router.replace(`/admin/plans${p.toString() ? `?${p}` : ''}`, { scroll: false });
  };
  const issuedToday = db.plans.filter(
    (p) => p.issuedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  return (
    <PanelShell title="الخطط" meta="طباعة خطة، أو تعديل منهج مستوى" onClose={onClose}>
      <PanelGroup label="الشاشات">
        <PanelItem active={onPrint} onClick={() => router.push('/admin/plans')}>طباعة خطة لطالب</PanelItem>
        <PanelItem active={onLevels} onClick={() => router.push('/admin/plans/levels')}>تعديل مستوى</PanelItem>
        <PanelItem active={onCurriculum} onClick={() => router.push('/admin/plans/curriculum')}>منهج الحفظ</PanelItem>
      </PanelGroup>

      {onPrint && (
        <PanelGroup label="مسار الطالب">
          <PanelItem active={!picked} count={db.students.filter((s) => s.track && s.track !== 'TALQEEN').length}
            onClick={() => setTrack(null)}>كل المسارات</PanelItem>
          {TRACKS.map((t) => (
            <PanelItem key={t} active={picked === t} count={byTrack(t)}
              onClick={() => setTrack(t)}>{TRACK_AR[t]}</PanelItem>
          ))}
        </PanelGroup>
      )}

      {/* which levels exist to print or edit — the answer to «هل المستوى جاهز؟»
          before he picks it, not after */}
      <PanelGroup label="المنهج المحفوظ">
        {cover.length === 0 ? (
          <p className="px-1.5 py-2 text-panel leading-relaxed text-ink-500">
            لا منهج محفوظ بعد. ارفع ملف «منهج الحفظ» من الصفحة الرئيسية.
          </p>
        ) : cover.map((c) => (
          <button key={c.track} onClick={() => router.push(`/admin/plans/levels?track=${c.track}`)}
            className="flex w-full items-baseline justify-between rounded-lg px-1.5 py-1.5 text-start transition-colors hover:bg-ink-100">
            <span className="text-panel text-ink-700">{TRACK_AR[c.track]}</span>
            <span className="text-micro text-ink-500">
              <Num className="font-medium text-ink-800">{c.levels.length}</Num> مستوى
            </span>
          </button>
        ))}
      </PanelGroup>

      <PanelGroup label="اليوم">
        <p className="px-1.5 text-panel leading-relaxed text-ink-500">
          {issuedToday > 0
            ? <>طُبعت <Num className="font-medium text-ink-800">{issuedToday}</Num> خطة اليوم.</>
            : 'لم تُطبع خطة اليوم بعد.'}
        </p>
      </PanelGroup>
    </PanelShell>
  );
}
