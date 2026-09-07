'use client';
/* الإعدادات — two sections that have nothing to do with each other.
   What an exam is worth and what the bands are called is the halaqa's own
   policy, edited often. Wiping the database is a once-a-term act with a
   confirmation in front of it. Keeping them on one scrolling page put the
   reset button below the points table, which is not where a destructive
   button belongs. */
import { useSearchParams, useRouter } from 'next/navigation';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { Num } from '@/components/Num';
import { useDB } from '@/lib/store';

export type SettingsSection = 'points' | 'database';

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; sub: string }[] = [
  { id: 'points',   label: 'النقاط',        sub: 'ما يُمنح، وبنوده' },
  { id: 'database', label: 'قاعدة البيانات', sub: 'الحجم، والتصفير' },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();
  const current = (sp.get('s') as SettingsSection) || 'points';

  return (
    <PanelShell title="الإعدادات" meta="إعدادات الموقع العامة" onClose={onClose}>
      <PanelGroup label="الأقسام">
        {SETTINGS_SECTIONS.map((s) => (
          <PanelItem key={s.id} active={current === s.id} sub={s.sub}
            onClick={() => router.replace(`/admin/settings?s=${s.id}`, { scroll: false })}>
            {s.label}
          </PanelItem>
        ))}
      </PanelGroup>

      <PanelGroup label="ما في النظام">
        <p className="px-1.5 text-panel leading-relaxed text-ink-500">
          <Num className="font-medium text-ink-800">{db.students.length}</Num> طالبًا ·{' '}
          <Num className="font-medium text-ink-800">{db.halaqat.length}</Num> حلقات ·{' '}
          <Num className="font-medium text-ink-800">{db.exams.length}</Num> اختبارًا ·{' '}
          <Num className="font-medium text-ink-800">{db.txns.length}</Num> حركة نقاط
        </p>
      </PanelGroup>
    </PanelShell>
  );
}
