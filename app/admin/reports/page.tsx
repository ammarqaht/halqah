'use client';
/* مركز التقارير — SPEC.md §6.11 (إد-٥-هـ)
   Everything printable, in one place. Print is a first-class output here: the
   supervisor prints daily, and until now each report lived behind the screen
   that produced it. */
import { useState } from 'react';
import Link from 'next/link';
import {
  FileText, Users2, BarChart3, Award, Ticket, PackageCheck, Trophy,
  ClipboardList, Printer, ExternalLink, Inbox,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { useDB } from '@/lib/store';
import { shortName } from '@/lib/normalise';

type Report = {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  href?: string;
  /** Reports that need a halaqa chosen before they mean anything. */
  needsHalaqa?: boolean;
  count?: number;
};

export default function ReportsPage() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const [halaqaId, setHalaqaId] = useState('');

  const activeBatches = db.batches.filter((b) => !b.revokedAt).length;
  const pending = db.orders.filter((o) => o.status === 'PENDING').length;

  const reports: Report[] = [
    {
      id: 'halaqa', title: 'تقرير المعلّم عن حلقته', icon: Users2, needsHalaqa: true,
      body: 'طلاب الحلقة ومستوياتهم وآخر اختباراتهم، ومن اختُبر لدى الجمعية مظلَّلًا. هو ما تطبعه كل ثلاثة أسابيع.',
    },
    {
      id: 'statistics', title: 'إحصائية الجمعية', icon: BarChart3, href: '/print/statistics',
      body: 'أعداد الطلاب والحلقات، وتوزيعهم على المسارات والمراحل والجنسيات، والأجزاء المختبَرة.',
    },
    {
      id: 'honour', title: 'لوحة الشرف', icon: Trophy, href: '/print/honour',
      body: 'أعلى الطلاب في النقاط — للتعليق في الحلقة.',
    },
    {
      id: 'bookings', title: 'قائمة اختبارات اليوم', icon: ClipboardList, href: '/print/bookings',
      body: 'من حُجز له اختبار، بمستواه ونوع وسامه.', count: db.bookings.length,
    },
    {
      id: 'pick-list', title: 'قائمة تسليم الهدايا', icon: PackageCheck, href: '/print/pick-list',
      body: 'الطلبات المعلّقة مرتّبة بالحلقة، لتسلّمها للمعلّمين.', count: pending,
    },
  ];

  const halaqaOptions = [
    { value: '', label: '— اختر حلقة —' },
    ...db.halaqat.map((h) => ({ value: h.id, label: shortName(h.teacher), hint: h.timeSlot })),
  ];

  if (!db.students.length) {
    return (
      <>
        <TopBar title="التقارير" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا توجد بيانات بعد"
              body="التقارير تُبنى من بياناتك — ارفع ملفًا أولًا."
              action={<Link href="/admin/students/import"><Btn variant="primary" size="lg">رفع ملف</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="التقارير" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <header className="rise mb-8">
          <h2 className="font-display text-d1 text-ink-900">مركز التقارير</h2>
          <p className="mt-2 max-w-[44rem] text-base2 text-ink-600">
            كل ما تحتاج طباعته في مكان واحد. تُفتح في صفحة مستقلّة بمقاس A4، فما تراه هو ما يُطبع.
          </p>
        </header>

        <Sheet className="rise mb-4">
          <SheetHead title="تقرير حلقة" meta="اختر الحلقة ثم افتح التقرير" />
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[18rem] flex-1">
              <Combobox value={halaqaId} onChange={setHalaqaId} options={halaqaOptions}
                placeholder="اختر حلقة" searchPlaceholder="ابحث باسم المعلّم…" />
            </div>
            <Link href={halaqaId ? `/print/halaqa?halaqa=${halaqaId}` : '#'} target="_blank"
              className={!halaqaId ? 'pointer-events-none opacity-50' : undefined}>
              <Btn variant="primary" icon={Printer}>فتح التقرير</Btn>
            </Link>
          </div>
        </Sheet>

        <div className="rise grid gap-3 sm:grid-cols-2">
          {reports.filter((r) => r.href).map((r) => (
            <Link key={r.id} href={r.href!} target="_blank"
              className="group flex flex-col rounded-xl border border-ink-150 bg-paper p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="rounded-lg bg-ink-100 p-2 text-ink-600 transition-colors group-hover:bg-brand-100 group-hover:text-brand-800">
                  <r.icon size={17} strokeWidth={1.9} />
                </span>
                {r.count !== undefined && (
                  <Chip tone={r.count ? 'brand' : 'ink'}><Num>{r.count}</Num></Chip>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-lg2 font-medium text-ink-900">
                {r.title}
                <ExternalLink size={13} className="text-ink-400" />
              </p>
              <p className="mt-1.5 text-panel leading-relaxed text-ink-600">{r.body}</p>
            </Link>
          ))}
        </div>

        <Sheet className="rise mt-4">
          <SheetHead title="تقارير تُفتح من شاشاتها"
            meta="لأنها تخصّ سجلًّا بعينه تختاره هناك" />
          <div className="divide-y divide-ink-150">
            {[
              { icon: FileText, t: 'خطة الحفظ لمستوى', where: 'الخطط', href: '/admin/plans' },
              { icon: Ticket, t: 'بطاقات أكواد النقاط', where: 'النقاط والأكواد', href: '/admin/points/codes',
                n: activeBatches },
              { icon: Award, t: 'تقرير الطالب الشامل', where: 'الطلاب والحلقات', href: '/admin/students' },
            ].map((x) => (
              <Link key={x.t} href={x.href}
                className="flex items-center gap-3 py-3 transition-colors hover:bg-page/50">
                <x.icon size={16} className="shrink-0 text-ink-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-ink-900">{x.t}</span>
                  <span className="block text-micro text-ink-500">من شاشة «{x.where}»</span>
                </span>
                {x.n !== undefined && <Chip tone="ink"><Num>{x.n}</Num> دفعة</Chip>}
              </Link>
            ))}
          </div>
        </Sheet>
      </div>
    </>
  );
}
