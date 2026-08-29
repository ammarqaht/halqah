'use client';
/* The panel for الطلاب والحلقات — DESIGN.md §4: a live filter surface, and the
   place where halaqat are created and edited, so the supervisor never leaves
   the roster to manage the circles it is grouped by. */
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Pencil, Users2 } from 'lucide-react';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { HalaqaDialog } from '@/components/HalaqaDialog';
import { useDB } from '@/lib/store';
import { TRACK_AR, type Halaqa } from '@/lib/types';
import { Num } from '@/components/Num';
import { shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

export function StudentsPanel({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const router = useRouter();
  const sp = useSearchParams();
  const [editing, setEditing] = useState<Halaqa | 'new' | null>(null);

  const set = (key: string, val: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (val === null || next.get(key) === val) next.delete(key); else next.set(key, val);
    router.replace(`/admin/students${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const counts = useMemo(() => {
    const byHalaqa = new Map<string, number>();
    const byTrack = new Map<string, number>();
    const byStage = new Map<string, number>();
    const byStatus = new Map<string, number>();
    let orphan = 0;
    for (const s of db.students) {
      if (s.halaqaId) byHalaqa.set(s.halaqaId, (byHalaqa.get(s.halaqaId) ?? 0) + 1); else orphan++;
      if (s.track) byTrack.set(s.track, (byTrack.get(s.track) ?? 0) + 1);
      if (s.stage) byStage.set(s.stage, (byStage.get(s.stage) ?? 0) + 1);
      byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
    }
    return { byHalaqa, byTrack, byStage, byStatus, orphan };
  }, [db.students]);

  const halaqa = sp.get('halaqa');

  return (
    <>
      <PanelShell title="الطلاب والحلقات"
        meta={db.students.length ? `${db.students.length} طالبًا · ${db.halaqat.length} حلقات` : 'لا توجد بيانات بعد'}
        onClose={onClose}>

        <PanelGroup label="الحلقات">
          <button onClick={() => setEditing('new')}
            className="mb-1.5 flex w-full items-center gap-2 rounded-md border border-dashed border-ink-300 px-2 py-2 text-panel text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800">
            <Plus size={15} strokeWidth={2} /> إضافة حلقة
          </button>

          <PanelItem active={!halaqa} onClick={() => set('halaqa', null)} count={db.students.length}>
            كل الطلاب
          </PanelItem>

          {db.halaqat.map((h) => {
            const active = halaqa === h.id;
            return (
              <div key={h.id}
                className={cx('group mb-0.5 flex items-center gap-1 rounded-md pe-1 transition-colors',
                  active ? 'bg-brand-100' : 'hover:bg-ink-100')}>
                <button onClick={() => set('halaqa', h.id)} title={h.teacher}
                  className="flex min-w-0 flex-1 flex-col items-start px-2 py-2 text-right">
                  <span className={cx('block w-full truncate text-panel',
                    active ? 'font-medium text-brand-800' : 'text-ink-700')}>
                    {shortName(h.teacher)}
                  </span>
                  <span className="mt-0.5 block text-micro text-ink-500">{h.timeSlot}</span>
                </button>
                <button onClick={() => setEditing(h)}
                  title={`تعديل حلقة ${h.teacher}`} aria-label={`تعديل حلقة ${h.teacher}`}
                  className="shrink-0 rounded p-1 text-ink-400 opacity-0 transition-opacity hover:bg-ink-150 hover:text-ink-800 focus-visible:opacity-100 group-hover:opacity-100">
                  <Pencil size={13} strokeWidth={1.9} />
                </button>
                <span className={cx('shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium',
                  active ? 'bg-brand-200 text-brand-900' : 'bg-ink-100 text-ink-600')}>
                  <Num>{counts.byHalaqa.get(h.id) ?? 0}</Num>
                </span>
              </div>
            );
          })}

          {counts.orphan > 0 && (
            <PanelItem tone="risk" active={halaqa === 'none'} onClick={() => set('halaqa', 'none')} count={counts.orphan}>
              بلا حلقة
            </PanelItem>
          )}
        </PanelGroup>

        {db.students.length > 0 && Object.keys(counts.byStage).length > 0 && (
          <PanelGroup label="المرحلة">
            {[...counts.byStage.entries()].map(([k, v]) => (
              <PanelItem key={k} active={sp.get('stage') === k} onClick={() => set('stage', k)} count={v}>{k}</PanelItem>
            ))}
          </PanelGroup>
        )}

      </PanelShell>

      <HalaqaDialog open={editing !== null} halaqa={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)} />
    </>
  );
}
