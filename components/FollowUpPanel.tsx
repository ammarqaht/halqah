'use client';
/* The panel for المتابعة — DESIGN.md §4: «Saved lists — ready for association,
   late on level, not examined». The lists are the point of the screen: the
   supervisor keeps these in his head today, and here they are counted for him
   before he asks. A list whose count is zero still shows — an empty ready-list
   is an answer («لا أحد جاهزًا»), not an absence. */
import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { plural } from '@/components/Num';
import { useDB } from '@/lib/store';
import { followUpRows, followedRows, listCounts } from '@/lib/followup';
import { shortName } from '@/lib/normalise';

export function FollowUpPanel({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const onFollowUp = path.startsWith('/admin/follow-up');

  const set = (key: string, val: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (val === null || next.get(key) === val) next.delete(key); else next.set(key, val);
    router.replace(`/admin/follow-up${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const rows = useMemo(() => followedRows(followUpRows(db)), [db]);

  const list = sp.get('list');
  const halaqa = sp.get('halaqa');

  /* The counts label the sheets the items OPEN — and opening keeps the active
     halaqa filter, so the counts are scoped to it too or badge and table
     would disagree. The «الحلقات» group itself stays global: it IS the filter. */
  const counts = useMemo(() => {
    const byHalaqa = new Map<string, number>();
    for (const r of rows) {
      if (r.student.halaqaId) {
        byHalaqa.set(r.student.halaqaId, (byHalaqa.get(r.student.halaqaId) ?? 0) + 1);
      }
    }
    const scoped = halaqa ? rows.filter((r) => r.student.halaqaId === halaqa) : rows;
    return { byHalaqa, scoped: scoped.length, ...listCounts(scoped) };
  }, [rows, halaqa]);

  return (
    <PanelShell title="المتابعة والتقارير"
      meta={rows.length
        ? plural(rows.length, 'طالب واحد يُتابَع', 'طالبان يُتابَعان', 'طلاب يُتابَعون', 'طالبًا يُتابَع')
        : 'لا طلاب بعد'}
      onClose={onClose}>

      <PanelGroup label="الشاشات">
        <PanelItem active={onFollowUp} onClick={() => router.push('/admin/follow-up')}>
          المتابعة
        </PanelItem>
        <PanelItem active={path.startsWith('/admin/reports')}
          onClick={() => router.push('/admin/reports')}>
          التقارير
        </PanelItem>
      </PanelGroup>

      {onFollowUp && rows.length > 0 && (
        <>
          <PanelGroup label="الكشوف الجاهزة">
            <PanelItem active={!list} onClick={() => set('list', null)} count={counts.scoped}>
              كل الطلاب
            </PanelItem>
            <PanelItem active={list === 'ready'} tone="ok" count={counts.ready}
              onClick={() => set('list', 'ready')}>جاهزون للجمعية</PanelItem>
            <PanelItem active={list === 'late'} tone="warn" count={counts.late}
              onClick={() => set('list', 'late')}>متأخرون في مستواهم</PanelItem>
            <PanelItem active={list === 'unexamined'} tone="risk" count={counts.overdue}
              onClick={() => set('list', 'unexamined')}>لم يُختبروا مؤخرًا</PanelItem>
            <PanelItem active={list === 'top'} count={counts.top}
              onClick={() => set('list', 'top')}>المتفوقون</PanelItem>
          </PanelGroup>

          {counts.byHalaqa.size > 0 && (
            <PanelGroup label="الحلقات">
              <PanelItem active={!halaqa} onClick={() => set('halaqa', null)}>كل الحلقات</PanelItem>
              {db.halaqat.map((h) => {
                const n = counts.byHalaqa.get(h.id) ?? 0;
                if (!n) return null;
                return (
                  <PanelItem key={h.id} active={halaqa === h.id}
                    onClick={() => set('halaqa', h.id)} count={n} sub={h.timeSlot}>
                    {shortName(h.teacher)}
                  </PanelItem>
                );
              })}
            </PanelGroup>
          )}
        </>
      )}
    </PanelShell>
  );
}
