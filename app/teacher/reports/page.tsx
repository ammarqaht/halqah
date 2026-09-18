'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   §١٤ تقارير المعلم — «ما يحتاج المعلم طباعته أو إرساله، في مكان واحد».

   Six of them here, and they are not equal: four are lists about the halaqa, one
   is the sheet he sends upward and one is pinned to a wall. So they are grouped
   that way rather than printed as a flat menu of identical rows.

   The seventh and eighth — تقرير الطالب الشامل and خطة الطالب — are about ONE
   student and open from his own file. They were listed here as cards whose only
   action was «افتحه من ملف الطالب», which is a signpost rather than a
   destination.

   «وكلها في صفحة واحدة» — every sheet is an A4 page, and the period the three
   list reports cover is chosen here, once, rather than on each of them.
   ───────────────────────────────────────────────────────────────────────── */
import { useState } from 'react';
import Link from 'next/link';
import {
  Award, CalendarRange, FileText, Printer, ShieldCheck, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Chip } from '@/components/ui';
import { DateRangeField } from '@/components/DateField';
import { Num } from '@/components/Num';
import { useMe } from '@/components/teacher/Me';
import { COPY } from '@/content/teacher';
import { cx } from '@/lib/cx';

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Report = {
  id: string;
  title: string;
  body: string;
  href: string;
  icon: LucideIcon;
  /** True when the sheet covers the period chosen above. */
  periodic?: boolean;
};

const HALAQA: Report[] = [
  {
    id: 'roster', title: 'كشف حلقتي', icon: Users,
    body: 'طلابك ومستوياتهم ومقرّراتهم وآخر تسميع ونقاطهم — ورقة واحدة تحملها معك.',
    href: '/teacher/print/roster',
  },
  {
    id: 'absence', title: 'كشف الغياب', icon: CalendarRange, periodic: true,
    body: 'حضور طلابك في المدة التي تختارها، ومجموع غياب كل طالب — محسوبًا على أيام '
      + 'حلقتك وحدها لا على أيام التقويم.',
    href: '/teacher/print/absence',
  },
  {
    id: 'incomplete', title: 'كشف التسميع الناقص', icon: FileText, periodic: true,
    body: 'من تكرّر انتقاله بلا مراجعة — لتعالجه قبل أن يتراكم.',
    href: '/teacher/print/incomplete',
  },
  {
    id: 'weekly', title: 'الورقة الأسبوعية', icon: Printer,
    body: 'الورقة بأعمدتها، للاحتياط عند تعطّل الجوال — وما يُملأ فيها يُدخل بعدُ في '
      + 'صفحة اليوم.',
    href: '/teacher/print/weekly',
  },
];

const OUTWARD: Report[] = [
  {
    id: 'due', title: 'المستحقون للاختبار', icon: Award,
    body: 'من بلغ مقرّر الاختبار من طلابك، بمستوياتهم وتاريخ استحقاقهم ومواعيد '
      + 'المحجوز منها — الكشف الذي ترسله إلى المشرف.',
    href: '/teacher/print/due',
  },
  {
    id: 'honour', title: 'لوحة شرف الحلقة', icon: Award,
    body: 'أعلى خمسة في النقاط — تُطبع وتُعلَّق في مكان الحلقة.',
    href: '/teacher/print/honour',
  },
  /* «أضف تقرير فرسان الأسبوع في ما يُرسل ويُعلَّق» (client, 18 Sep 2026), and it
     is not a variant of لوحة الشرف: that one ORDERS balances over the term, this
     one NAMES whoever met every requirement on every day the halaqa met this
     week. No first and no fifth — some weeks it is empty. */
  {
    id: 'knights', title: 'فرسان الأسبوع', icon: ShieldCheck,
    body: 'من أتمّ أسبوعه كاملًا: حاضرًا في وقته، بثوبه، وسمّع الدرس والمراجعتين '
      + 'في كل يوم حلقة — بلا ترتيب، فهم سواء.',
    href: '/teacher/print/knights',
  },
];

/* «شل بلوك تقارير الطالب الواحد» (client, 18 Sep 2026). تقرير الطالب الشامل and
   خطة الطالب were listed here as two cards whose only action was «افتحه من ملف
   الطالب» — a menu entry that tells you to go somewhere else is a signpost, not
   a destination. Both now live where the student does, on his own file. */

export default function ReportsScreen() {
  const { me } = useMe();
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => iso(new Date()));

  const period = `from=${from}&to=${to}`;

  return (
    <div className="space-y-3.5">
      <Sheet>
        <SheetHead title="التقارير" meta={COPY.reportsHint} />
        {/* The period, chosen once — two of the sheets below carry it and the
            rest are «as things stand now». And chosen in the site's own calendar
            rather than the
            operating system's: «خانات التاريخ في صفحة التقارير تكون بهوية
            الموقع» (client, 18 Sep 2026). */}
        <span className="mb-1 block text-micro text-ink-500">المدة</span>
        <DateRangeField from={from} to={to} max={iso(new Date())} label="مدة التقارير"
          onChange={(a, b) => { setFrom(a); setTo(b); }} />
        {me && (
          <p className="mt-2.5 text-xs2 text-ink-500">
            حلقتك: {me.halaqa.name} — <Num>{me.counts.roster}</Num> طالبًا.
          </p>
        )}
      </Sheet>

      <Group title="كشوف حلقتي" reports={HALAQA} period={period} />
      <Group title="ما يُرسل ويُعلَّق" reports={OUTWARD} period={period} />

    </div>
  );
}

function Group({ title, reports, period }: {
  title: string; reports: Report[]; period: string;
}) {
  return (
    <section>
      <h2 className="px-0.5 pb-2.5 text-base2 font-bold text-ink-900">{title}</h2>
      <ul className="space-y-2">
        {reports.map((r) => (
          <li key={r.id}>
            <Link href={r.periodic ? `${r.href}?${period}` : r.href} target="_blank"
              className={cx('press block rounded-2xl border border-ink-150 bg-paper px-[18px] py-3.5 shadow-soft transition-colors hover:border-brand-200')}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
                  <r.icon size={17} strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-base2 font-medium text-ink-900">
                    {r.title}
                    {r.periodic && <Chip tone="ink">بالمدة المختارة</Chip>}
                  </p>
                  <p className="mt-0.5 text-xs2 leading-relaxed text-ink-600">{r.body}</p>
                </div>
                <Printer size={16} className="mt-1.5 shrink-0 text-ink-300" strokeWidth={1.9} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
