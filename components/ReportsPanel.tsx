'use client';
/* التقارير — the panel picks the report and whatever it needs, and the page
   beside it shows the sheet itself. A report you cannot see before printing is
   a report you print twice. */
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users2, BarChart3, Award, Trophy, PackageCheck, ClipboardList, Coins, FileUser,
  CalendarRange,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { Combobox } from '@/components/Combobox';
import { Num } from '@/components/Num';
import { useDB } from '@/lib/store';
import { shortName } from '@/lib/normalise';

export type ReportId =
  | 'halaqa' | 'student' | 'association' | 'ready' | 'points' | 'honour'
  | 'pick-list' | 'bookings' | 'period';

/** The association sheet's five tables, each printable on its own. */
export const ASSOC_SECTIONS: { id: string; label: string }[] = [
  { id: 'tracks',        label: 'المسارات' },
  { id: 'stages',        label: 'المراحل الدراسية' },
  { id: 'nationalities', label: 'الجنسيات' },
  { id: 'exams',         label: 'حصيلة الاختبارات' },
  { id: 'halaqat',       label: 'الحلقات' },
];

export const REPORTS: {
  id: ReportId; label: string; icon: LucideIcon;
  needs?: 'halaqa' | 'student' | 'period';
  /** Some reports read better across everyone; those allow an empty choice. */
  optional?: boolean;
}[] = [
  { id: 'halaqa',      label: 'تقرير حلقة المعلّم',      icon: Users2,        needs: 'halaqa' },
  { id: 'student',     label: 'التقرير الشامل للطالب',   icon: FileUser,      needs: 'student' },
  { id: 'association', label: 'إحصاءات الجمعية',         icon: BarChart3 },
  { id: 'ready',       label: 'الجاهزون لاختبار الجمعية', icon: Award,        needs: 'halaqa', optional: true },
  { id: 'points',      label: 'قائمة نقاط الحلقة',       icon: Coins,         needs: 'halaqa' },
  { id: 'honour',      label: 'لوحة الشرف',              icon: Trophy,        needs: 'halaqa', optional: true },
  { id: 'period',      label: 'بيانات فترة',             icon: CalendarRange, needs: 'period' },
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

      {/* «إحصاءات الجمعية» carries five tables, and the association asks for
          different cuts at different times. Nothing chosen means all of them,
          which is what the report has always meant. */}
      {current === 'association' && (
        <PanelGroup label="أقسام التقرير">
          {(() => {
            const picked = (sp.get('sections') ?? '').split(',').filter(Boolean);
            const all = picked.length === 0;
            const toggle = (id: string) => {
              const now = all ? ASSOC_SECTIONS.map((x) => x.id) : picked;
              const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
              /* Everything ticked is the same as nothing ticked — keep the URL
                 clean so a shared link stays the plain report. */
              set('sections', next.length === ASSOC_SECTIONS.length ? '' : next.join(','));
            };
            return (
              <>
                <PanelItem active={all} onClick={() => set('sections', '')}>الكل</PanelItem>
                {ASSOC_SECTIONS.map((sec) => (
                  <PanelItem key={sec.id} active={all || picked.includes(sec.id)}
                    onClick={() => toggle(sec.id)}>{sec.label}</PanelItem>
                ))}
              </>
            );
          })()}
        </PanelGroup>
      )}

      {/* بيانات فترة — the only report whose subject is a span of time. */}
      {report.needs === 'period' && (
        <PanelGroup label="الفترة">
          <div className="space-y-2 px-1.5">
            {([['from', 'من تاريخ'], ['to', 'إلى تاريخ']] as const).map(([k, label]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-micro text-ink-500">{label}</span>
                <input type="date" value={sp.get(k) ?? ''} onChange={(e) => set(k, e.target.value)}
                  className="h-9 w-full rounded-lg border border-ink-200 bg-paper px-2 text-panel text-ink-800" />
              </label>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {([['month', 'هذا الشهر'], ['quarter', 'آخر ٣ أشهر'], ['year', 'هذه السنة']] as const)
                .map(([k, label]) => (
                <button key={k} onClick={() => {
                  const now = new Date();
                  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const start = k === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1)
                    : k === 'quarter' ? new Date(now.getFullYear(), now.getMonth() - 2, 1)
                    : new Date(now.getFullYear(), 0, 1);
                  const p = new URLSearchParams(sp.toString());
                  p.set('from', iso(start)); p.set('to', iso(now));
                  router.replace(`/admin/reports?${p}`, { scroll: false });
                }}
                  className="rounded-lg border border-ink-200 bg-paper px-2 py-1 text-micro text-ink-600 transition-colors hover:border-brand-700 hover:bg-brand-50 hover:text-brand-800">
                  {label}
                </button>
              ))}
            </div>
            <p className="pt-1 text-micro leading-relaxed text-ink-500">
              اتركهما فارغين للمدة كاملة. التقرير يصف ما حدث في الفترة، لا من كان مقيَّدًا فيها.
            </p>
          </div>
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
