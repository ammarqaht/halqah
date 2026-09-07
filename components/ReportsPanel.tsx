'use client';
/* التقارير — the panel picks the report and whatever it needs, and the page
   beside it shows the sheet itself. A report you cannot see before printing is
   a report you print twice. */
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users2, BarChart3, Award, Trophy, PackageCheck, ClipboardList, Coins, FileUser,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { Combobox } from '@/components/Combobox';
import { Num } from '@/components/Num';
import { useDB } from '@/lib/store';
import { shortName } from '@/lib/normalise';

export type ReportId =
  | 'halaqa' | 'student' | 'association' | 'ready' | 'points' | 'honour'
  | 'pick-list' | 'bookings';

export const REPORTS: {
  id: ReportId; label: string; icon: LucideIcon;
  needs?: 'halaqa' | 'student';
  /** Some reports read better across everyone; those allow an empty choice. */
  optional?: boolean;
}[] = [
  { id: 'halaqa',      label: 'تقرير حلقة المعلّم',      icon: Users2,        needs: 'halaqa' },
  { id: 'student',     label: 'التقرير الشامل للطالب',   icon: FileUser,      needs: 'student' },
  { id: 'association', label: 'إحصاءات الجمعية',         icon: BarChart3 },
  { id: 'ready',       label: 'الجاهزون لاختبار الجمعية', icon: Award,        needs: 'halaqa', optional: true },
  { id: 'points',      label: 'قائمة نقاط الحلقة',       icon: Coins,         needs: 'halaqa' },
  { id: 'honour',      label: 'لوحة الشرف',              icon: Trophy,        needs: 'halaqa', optional: true },
  { id: 'pick-list',   label: 'قائمة تسليم الهدايا',     icon: PackageCheck },
  { id: 'bookings',    label: 'اختبارات اليوم',          icon: ClipboardList },
];

export function ReportsPanel({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();

  const current = (sp.get('r') as ReportId) || 'halaqa';
  const report = REPORTS.find((r) => r.id === current) ?? REPORTS[0];

  const set = (key: string, value: string) => {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value); else p.delete(key);
    router.replace(`/admin/reports?${p}`, { scroll: false });
  };

  const pickReport = (id: ReportId) => {
    const p = new URLSearchParams(sp.toString());
    p.set('r', id);
    /* A halaqa chosen for one report is usually the same halaqa for the next,
       so the choice survives the switch — but a student never carries over. */
    p.delete('student');
    router.replace(`/admin/reports?${p}`, { scroll: false });
  };

  const pending = db.orders.filter((o) => o.status === 'PENDING').length;

  return (
    <PanelShell title="التقارير" meta="اختر التقرير، ثم عاينه قبل الطباعة" onClose={onClose}>
      <PanelGroup label="التقرير">
        {REPORTS.map((r) => (
          <PanelItem key={r.id} active={current === r.id} onClick={() => pickReport(r.id)}
            count={r.id === 'pick-list' ? pending
              : r.id === 'bookings' ? db.bookings.length : undefined}>
            {r.label}
          </PanelItem>
        ))}
      </PanelGroup>

      {/* what this report still needs, asked for right under it */}
      {report.needs === 'halaqa' && (
        <PanelGroup label="الحلقة">
          <Combobox value={sp.get('halaqa') ?? ''} onChange={(v) => set('halaqa', v)}
            options={[
              ...(report.optional ? [{ value: '', label: 'كل الحلقات' }] : []),
              ...db.halaqat.map((h) => ({
                value: h.id, label: shortName(h.teacher), hint: h.timeSlot,
              })),
            ]}
            placeholder={report.optional ? 'كل الحلقات' : 'اختر الحلقة…'}
            searchPlaceholder="ابحث باسم المعلّم…" />
        </PanelGroup>
      )}

      {report.needs === 'student' && (
        <PanelGroup label="الطالب">
          <Combobox value={sp.get('student') ?? ''} onChange={(v) => set('student', v)}
            options={db.students.map((s) => ({
              value: s.id, label: s.fullName,
              hint: s.currentLevel != null ? `المستوى ${s.currentLevel}` : undefined,
            }))}
            placeholder="اختر الطالب…" searchPlaceholder="ابحث باسم الطالب…" />
        </PanelGroup>
      )}

      <PanelGroup label="ملخّص">
        <p className="px-1.5 text-panel leading-relaxed text-ink-500">
          <Num className="font-medium text-ink-800">{db.students.length}</Num> طالبًا ·{' '}
          <Num className="font-medium text-ink-800">{db.halaqat.length}</Num> حلقات ·{' '}
          <Num className="font-medium text-ink-800">{db.exams.length}</Num> اختبارًا
        </p>
      </PanelGroup>
    </PanelShell>
  );
}
