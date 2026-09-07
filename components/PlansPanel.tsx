'use client';
/* الخطط — everything to do with a memorisation sheet, on three screens that
   each do one thing: one prints, one edits, one holds the uploaded curriculum.
   They sit together because they are one job, and apart because printing a
   sheet and rewriting it are not the same act. */
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
  const onEdit = path.startsWith('/admin/plans/edit');
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

  return (
    <PanelShell title="الخطط" meta="عرضها، وطباعتها، وتعديلها" onClose={onClose}>
      <PanelGroup label="الشاشات">
        <PanelItem active={onPrint} onClick={() => router.push('/admin/plans')}>طباعة خطة لطالب</PanelItem>
        <PanelItem active={onEdit} onClick={() => router.push('/admin/plans/edit')}>تعديل الخطة</PanelItem>
        <PanelItem active={onCurriculum} onClick={() => router.push('/admin/plans/curriculum')}>منهج الحفظ</PanelItem>
      </PanelGroup>

      {/* No «نطاق التعديل» group: there is one scope now — the level, for
          everyone who takes it. A per-student sheet no longer exists. */}

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
      {/* «ورقة فارغة»: the supervisor keeps a stack of a level's sheets on the
          desk and writes a name on one when a boy reaches it. The curriculum of
          a level is the same for everyone who takes it, so nothing but the name
          is missing — and printing one issues nothing and promotes nobody. */}
      <PanelGroup label="ورقة فارغة">
        <p className="px-1.5 pb-1.5 text-panel leading-relaxed text-ink-500">
          بلا اسم — تُطبع بالمستوى وحده، ويُكتب الاسم باليد.
        </p>
        {cover.map((c) => (
          <div key={c.track} className="px-1.5 pb-1.5">
            <p className="mb-1 text-micro text-ink-500">{TRACK_AR[c.track]}</p>
            <div className="flex flex-wrap gap-1">
              {c.levels.map((n) => (
                <a key={n} href={`/print/plan/blank?track=${c.track}&level=${n}`}
                  target="_blank" rel="noreferrer"
                  title={`طباعة ورقة فارغة — ${TRACK_AR[c.track]} المستوى ${n}`}
                  className="rounded border border-ink-200 bg-paper px-1.5 py-0.5 text-micro text-ink-600 transition-colors hover:border-brand-700 hover:bg-brand-50 hover:text-brand-800">
                  <Num>{n}</Num>
                </a>
              ))}
            </div>
          </div>
        ))}
        {cover.length === 0 && (
          <p className="px-1.5 text-panel text-ink-500">ارفع «منهج الحفظ» أولًا.</p>
        )}
      </PanelGroup>

      <PanelGroup label="المنهج المحفوظ">
        {cover.length === 0 ? (
          <p className="px-1.5 py-2 text-panel leading-relaxed text-ink-500">
            لا منهج محفوظ بعد. ارفع ملف «منهج الحفظ» من الصفحة الرئيسية.
          </p>
        ) : cover.map((c) => (
          <button key={c.track} onClick={() => router.push(`/admin/plans/edit?track=${c.track}`)}
            className="flex w-full items-baseline justify-between rounded-lg px-1.5 py-1.5 text-start transition-colors hover:bg-ink-100">
            <span className="text-panel text-ink-700">{TRACK_AR[c.track]}</span>
            <span className="text-micro text-ink-500">
              <Num className="font-medium text-ink-800">{c.levels.length}</Num> مستوى
            </span>
          </button>
        ))}
      </PanelGroup>

      
    </PanelShell>
  );
}
