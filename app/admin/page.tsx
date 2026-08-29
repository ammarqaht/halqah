'use client';
/* الرئيسية — نظرة عامة  (SPEC.md §6.1 · إد-٢)
   Every figure is computed from what the supervisor imported. Nothing seeded. */
import Link from 'next/link';
import {
  Users, CircleDot, UploadCloud, AlertTriangle, FileText, ClipboardCheck, Ticket,
  ArrowLeft, Inbox,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { KPI, Split } from '@/components/Stat';
import { Btn, Empty, Chip } from '@/components/ui';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { useDB } from '@/lib/store';
import { derive } from '@/lib/derive';
import { cx } from '@/lib/cx';

const TRACK_TONE: Record<string, string> = {
  'ذهبي': 'bg-warn-500', 'فضي': 'bg-sage-500', 'تلقين': 'bg-info-500',
};

export default function OverviewPage() {
  const { panelOpen, setPanelOpen } = usePanel();
  const d = derive(useDB());

  if (d.isEmpty) {
    return (
      <>
        <TopBar title="الرئيسية" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا توجد بيانات بعد"
              body="ارفع تقرير رتل أو قاعدة بيانات الطلاب، وسيتعرّف النظام على شكل الملف بنفسه ويعرض عليك معاينة قبل الحفظ."
              action={<Link href="/admin/students/import">
                <Btn variant="primary" size="lg" icon={UploadCloud}>رفع ملف</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  const maxN = Math.max(...d.byHalaqa.map((h) => h.n), 1);

  return (
    <>
      <TopBar title="الرئيسية" crumbs={['حلقات جامع محمد العبدالكريم']} panelOpen={panelOpen}
        onOpenPanel={() => setPanelOpen(true)}
        action={<Link href="/admin/students/import"><Btn variant="primary" icon={UploadCloud}>رفع ملف</Btn></Link>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <header className="rise mb-9">
          <p className="text-micro uppercase tracking-[.14em] text-ink-500">الفصل الأول ١٤٤٨ هـ</p>
          <h2 className="mt-2 font-display text-d1 text-ink-900">مساء الخير، أبا عبدالله</h2>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI label="الطلاب" value={d.students} unit="طالبًا" icon={Users} accent
            sub={`نشط ${d.activeStudents}`} />
          <KPI label="الحلقات" value={d.halaqat} unit="حلقات" icon={CircleDot} delay={60}
            sub={d.byHalaqa[0] ? `أكبرها: ${d.byHalaqa[0].teacher}` : undefined} />
          <KPI label="بلا حلقة" value={d.orphans} unit="طالبًا" icon={AlertTriangle} delay={120}
            sub={d.orphans ? 'يحتاجون إسنادًا' : 'الجميع مُسنَدون'} />
          <KPI label="تحتاج مراجعة" value={d.flagged} unit="سجلًا" icon={AlertTriangle} delay={180}
            sub="أرقام هوية قصيرة أو مكرّرة" />
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-3">
          {[
            { t: 'المسارات', d: d.tracks, c: ['bg-sage-500', 'bg-info-500', 'bg-warn-500'] },
            { t: 'المراحل', d: d.stages, c: ['bg-brand-700', 'bg-brand-400', 'bg-sage-500', 'bg-ink-300'] },
            { t: 'الجنسية', d: d.nationalities, c: ['bg-brand-700', 'bg-ink-300'] },
          ].filter((b) => Object.keys(b.d).length).map((b, i) => (
            <Sheet key={b.t} className="rise">
              <h3 className="mb-4 text-xs2 font-medium text-ink-600">{b.t}</h3>
              <Split data={b.d} colors={b.c} />
            </Sheet>
          ))}
        </div>

        <Sheet className="rise mb-4">
          <SheetHead title="تقدّم الحلقات"
            meta="متوسّط أوجه الحفظ والمراجعة لكل طالب، من آخر ملف مرفوع"
            action={<Link href="/admin/students" className="flex items-center gap-1 text-xs2 text-brand-800 hover:underline">
              الطلاب والحلقات <ArrowLeft size={14} strokeWidth={2} /></Link>} />
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[38rem] border-collapse text-body">
              <thead>
                <tr className="border-b border-ink-200 text-cap text-ink-500">
                  {['الحلقة', 'الطلاب', 'المسار', 'أوجه الحفظ', 'أوجه المراجعة', 'الحضور'].map((h) => (
                    <th key={h} className="px-2 pb-2.5 text-start font-medium">{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {d.byHalaqa.map((h) => (
                  <tr key={h.id} className="border-b border-ink-150 last:border-0 transition-colors hover:bg-brand-50">
                    <td className="px-2 py-3 font-medium text-ink-900">{h.teacher}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-panel"><Num>{h.n}</Num></span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                          <span className="block h-full rounded-full bg-brand-400 transition-[width] duration-700 ease-brand"
                            style={{ width: `${(h.n / maxN) * 100}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex gap-1">
                        {Object.entries(h.tracks).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5 text-2xs text-ink-700">
                            <span className={cx('h-1.5 w-1.5 rounded-full', TRACK_TONE[k] ?? 'bg-ink-300')} />
                            {k} <Num>{v}</Num>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-panel text-ink-700"><Num>{h.hp.toFixed(2)}</Num></td>
                    <td className="px-2 py-3 text-panel text-ink-700"><Num>{h.rp.toFixed(2)}</Num></td>
                    <td className="px-2 py-3">
                      {h.att === null ? <span className="text-micro text-ink-400">—</span> : (
                        <Chip tone={h.att >= 60 ? 'ok' : h.att >= 40 ? 'warn' : 'risk'}><Num>{h.att}</Num>٪</Chip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sheet>

        <div className="rise grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: UploadCloud, label: 'رفع ملف', href: '/admin/students/import' },
            { icon: FileText, label: 'طباعة خطة لطالب', href: '/admin/plans' },
            { icon: ClipboardCheck, label: 'تسجيل اختبار', href: '/admin/exams' },
            { icon: Ticket, label: 'إصدار أكواد نقاط', href: '/admin/points' },
          ].map((s) => (
            <Link key={s.label} href={s.href}
              className="group flex items-center gap-3 rounded-xl border border-ink-150 bg-paper p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
              <span className="rounded-lg bg-ink-100 p-2 text-ink-600 transition-colors group-hover:bg-brand-100 group-hover:text-brand-800">
                <s.icon size={17} strokeWidth={1.9} />
              </span>
              <span className="text-body font-medium text-ink-800">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
