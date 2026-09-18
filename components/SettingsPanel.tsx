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

export type SettingsSection =
  'me' | 'points' | 'accounts' | 'teachers' | 'messages' | 'database';

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; sub: string }[] = [
  { id: 'me',       label: 'حسابي',          sub: 'كلمة المرور، والمشرفون' },
  /* النقاط gathers EVERY figure that pays: what an exam is worth, the bands, and
     — since 18 Sep 2026 — the daily items. Those sat under المعلمون because the
     teacher's portal introduced them, which is where they came FROM rather than
     what they are: «بلوك النقاط اليومية في صفحة المعلمون انقلها إلى صفحة
     النقاط». */
  { id: 'points',   label: 'النقاط',         sub: 'ما يُمنح، وبنوده، واليومية' },
  { id: 'accounts', label: 'حسابات الطلاب',  sub: 'اسم الدخول والرمز' },
  { id: 'teachers', label: 'المعلمون',       sub: 'حساباتهم، ومقرّرات طلابهم' },
  /* Its own page rather than a card at the foot of another: it WRITES to people
     — «قسم رسائل الإدارة عند المشرف يكون لها صفحة خاصة في الإعدادات» (client,
     18 Sep 2026). */
  { id: 'messages', label: 'الرسائل',        sub: 'إشعار للمعلمين والطلاب' },
  { id: 'database', label: 'قاعدة البيانات',  sub: 'الحجم، والتصفير' },
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
