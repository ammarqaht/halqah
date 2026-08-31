'use client';
/* The panel for الاختبارات — DESIGN.md §4 specifies «Booking queue for the day,
   and exam-type filter». The booking queue belongs to إد-٥-ج (the on-site exam
   screen) and does not exist yet, so it is **absent rather than empty**: the
   product's rule is that something which cannot be computed is not shown as a
   zero. It appears here when its screen ships. */
import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { plural } from '@/components/Num';
import { useDB } from '@/lib/store';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { shortName } from '@/lib/normalise';

const TYPES: ExamType[] = ['BADGE_GOLDEN', 'BADGE_DIAMOND', 'ASSOCIATION', 'MOCK', 'TAJWEED'];

export function ExamsPanel({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const path = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const set = (key: string, val: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (val === null || next.get(key) === val) next.delete(key); else next.set(key, val);
    router.replace(`/admin/exams${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const counts = useMemo(() => {
    const byType = new Map<string, number>();
    const byHalaqa = new Map<string, number>();
    let unpaid = 0;
    for (const e of db.exams) {
      byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
      if (e.halaqaId) byHalaqa.set(e.halaqaId, (byHalaqa.get(e.halaqaId) ?? 0) + 1);
      if (e.passed === true && e.pointsAwarded > 0 && !e.pointsPaid) unpaid++;
    }
    return { byType, byHalaqa, unpaid };
  }, [db.exams]);

  const type = sp.get('type');
  const halaqa = sp.get('halaqa');
  const onLog = path === '/admin/exams';

  return (
    <PanelShell title="الاختبارات"
      meta={db.exams.length
        ? plural(db.exams.length, 'اختبار واحد مسجَّل', 'اختباران مسجَّلان', 'اختبارات مسجَّلة', 'اختبارًا مسجَّلًا')
        : 'لا اختبارات بعد'}
      onClose={onClose}>

      <PanelGroup label="الشاشات">
        <PanelItem active={onLog} onClick={() => router.push('/admin/exams')}
          count={db.exams.length || undefined}>سجلّ الاختبارات</PanelItem>
        <PanelItem active={path.startsWith('/admin/exams/new')}
          onClick={() => router.push('/admin/exams/new')}>تسجيل اختبار</PanelItem>
      </PanelGroup>

      {onLog && db.exams.length > 0 && (
        <>
          {counts.unpaid > 0 && (
            <PanelGroup label="يحتاج تدخّلك">
              <PanelItem tone="warn" count={counts.unpaid}
                onClick={() => set('type', null)}>اجتاز ولم تُصرف نقاطه</PanelItem>
            </PanelGroup>
          )}

          <PanelGroup label="نوع الاختبار">
            <PanelItem active={!type} onClick={() => set('type', null)} count={db.exams.length}>
              كل الأنواع
            </PanelItem>
            {TYPES.map((t) => {
              const n = counts.byType.get(t) ?? 0;
              if (!n) return null;               // a type never used is not a zero row
              return (
                <PanelItem key={t} active={type === t} onClick={() => set('type', t)} count={n}>
                  {EXAM_TYPE_AR[t]}
                </PanelItem>
              );
            })}
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

      <button onClick={() => router.push('/admin/exams/new')}
        className="mt-1 flex w-full items-center gap-2 rounded-md border border-dashed border-ink-300 px-2 py-2 text-panel text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800">
        <Plus size={15} strokeWidth={2} /> تسجيل اختبار
      </button>
    </PanelShell>
  );
}
