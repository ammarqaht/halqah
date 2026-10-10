'use client';
/* التقارير — the panel picks the report and whatever it needs, and the page
   beside it shows the sheet itself. A report you cannot see before printing is
   a report you print twice. */
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users2, BarChart3, Award, Trophy, PackageCheck, ClipboardList, Coins, FileUser,
  CalendarRange, ShieldCheck, CalendarCheck, TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { Combobox } from '@/components/Combobox';
import { DateRangeField } from '@/components/DateField';
import { Num } from '@/components/Num';
import { useDB } from '@/lib/store';
import { shortName } from '@/lib/normalise';
import { REPORT_PARTS, defaultsOf, partsFrom } from '@/lib/reportParts';

export type ReportId =
  | 'halaqa' | 'student' | 'association' | 'ready' | 'points' | 'honour'
  | 'knights' | 'registration' | 'pick-list' | 'bookings' | 'period' | 'progress';


/** `YYYY-MM-DD` in local time — the same shape every date in this product has. */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
  /* Beside لوحة الشرف deliberately: that one ORDERS balances over the whole
     term, this one NAMES whoever met every requirement on every day his halaqa
     met this week. «ويكون فيه صفحة لطباعة أسماء الفرسان عند المشرف» (client,
     18 Sep 2026). */
  { id: 'knights',     label: 'فرسان الأسبوع',           icon: ShieldCheck,   needs: 'halaqa', optional: true },
  /* أسبوع حلقة على ورقة عرضية: الطلاب صفوفًا والأيام أعمدة — «تقرير تسجيل معلم»
     (client, 18 Sep 2026). It needs a halaqa and means little without one, so
     it is not optional. */
  { id: 'registration', label: 'تسجيل المعلم — أسبوع',    icon: CalendarCheck, needs: 'halaqa' },
  { id: 'period',      label: 'بيانات فترة',             icon: CalendarRange, needs: 'period' },
  /* The home screen's old «تقدّم الحلقات» — «وإحصائيات الفترة تكون في التقارير»
     (client, 18 Sep 2026). It is the رتل file's own arithmetic and belongs
     where a period is chosen deliberately, not on the screen that answers
     «what is happening this afternoon». */
  { id: 'progress',    label: 'تقدّم الحلقات — للفترة',   icon: TrendingUp },
  { id: 'pick-list',   label: 'قائمة تسليم الهدايا',     icon: PackageCheck },
  { id: 'bookings',    label: 'اختبارات اليوم',          icon: ClipboardList },
];

export function ReportsPanel({ onClose }: { onClose: () => void }) {
  const db = useDB();
  /* Booked for today and not yet sat — exactly what `/print/bookings` prints. */
  const dueToday = db.bookings.filter(
    (b) => b.status === 'BOOKED' && b.scheduledOn === iso(new Date())).length;
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
            /* «يظهر لي أنه فيه ١٨ واحد، لكن في الورقة ما يظهر لي أحد» (client,
               18 Sep 2026) — the badge counted every booking ever made while
               the sheet printed the day's. The sheet was right: this is
               «اختبارات اليوم», so the number beside it is the day's too. */
            count={r.id === 'pick-list' ? pending
              : r.id === 'bookings' ? (dueToday || undefined) : undefined}>
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

      {/* «خلني اقدر اختار وش اطبع» (client, 10 Oct 2026) — every report that has
          parts lists them here: its sections, or its columns. The choice rides
          in the URL (lib/reportParts), so the preview beside this panel and
          the printed sheet are the same. */}
      {REPORT_PARTS[current] && (() => {
        const spec = REPORT_PARTS[current];
        const on = partsFrom(current, sp.get('parts') ?? sp.get('sections'));
        const write = (next: Set<string>) => {
          const p = new URLSearchParams(sp.toString());
          p.delete('sections');
          const ids = spec.parts.map((x) => x.id).filter((x) => next.has(x));
          const isDefault = ids.join(',') === defaultsOf(current).join(',');
          if (isDefault) p.delete('parts');
          else p.set('parts', ids.length ? ids.join(',') : 'none');
          router.replace(`/admin/reports?${p}`, { scroll: false });
        };
        const toggle = (id: string) => {
          const next = new Set(on);
          if (next.has(id)) next.delete(id); else next.add(id);
          write(next);
        };
        return (
          <div data-tour="report-parts">
          <PanelGroup label={spec.kind === 'columns' ? 'الأعمدة المطبوعة' : 'أقسام التقرير'}>
            {spec.parts.map((x) => (
              <label key={x.id}
                className="mb-0.5 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-panel text-ink-700 transition-colors hover:bg-ink-100">
                <input type="checkbox" checked={on.has(x.id)} onChange={() => toggle(x.id)}
                  className="h-4 w-4 shrink-0 accent-[#0B5F59]" />
                <span className="min-w-0 flex-1 truncate">{x.label}</span>
              </label>
            ))}
            <div className="mt-1 flex gap-3 px-2 text-micro">
              <button type="button" className="text-brand-800 hover:underline"
                onClick={() => write(new Set(spec.parts.map((x) => x.id)))}>الكل</button>
              <button type="button" className="text-ink-500 hover:underline"
                onClick={() => write(new Set(defaultsOf(current)))}>الافتراضي</button>
            </div>
          </PanelGroup>
          </div>
        );
      })()}

      {/* بيانات فترة — the only report whose subject is a span of time. */}
      {report.needs === 'period' && (
        <PanelGroup label="الفترة">
          <div className="space-y-2 px-1.5">
            {/* ONE calendar, in the site's own identity — «خانات تحديد فترة في
                الموقع كامل في الثلاث بوابات تكون بنفس الطريقة اللي سوّيتها في
                لسان فترة طالب» (client, 18 Sep 2026). A native pair of
                `<input type="date">` opens the operating system's flyout, can be
                set to an impossible order, and looks like Windows on an Arabic
                screen — the three complaints §7.2 answers. */}
            <DateRangeField chrome="field"
              from={sp.get('from') || iso(new Date(Date.now() - 29 * 86_400_000))}
              to={sp.get('to') || iso(new Date())}
              max={iso(new Date())}
              label="فترة التقرير"
              onChange={(a, b) => { set('from', a); set('to', b); }} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {([['month', 'هذا الشهر'], ['quarter', 'آخر ٣ أشهر'], ['year', 'هذه السنة']] as const)
                .map(([k, label]) => (
                <button key={k} onClick={() => {
                  const now = new Date();
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
