'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   §١٤ تقارير المعلم — «ما يحتاج المعلم طباعته أو إرساله، في مكان واحد».

   READ HERE FIRST, PRINT SECOND — 22 Sep 2026.

   Every report used to be a 794px A4 sheet that opened in a new tab with a
   print button on it. A teacher holds a phone 390px across while standing
   between twenty-five boys: an A4 table there is a horizontal scrollbar and
   type too small to read, and the screen told him — correctly — that he was
   looking at a piece of paper he had no printer for.

   So the report opens HERE, as cards built for a thumb, and «طباعة» is a
   button on it rather than the only way in. The A4 routes are untouched: they
   are what comes out of a printer, and they are still right for that.

   The period is chosen once, at the top, and only the sheets that cover a
   period carry it — the rest are «as things stand now».
   ───────────────────────────────────────────────────────────────────────── */
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Award, CalendarRange, FileText, Printer, ShieldCheck, Users, Trophy,
  ChevronLeft, AlertTriangle, Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip } from '@/components/ui';
import { DateRangeField } from '@/components/DateField';
import { Num, toArabicDigits } from '@/components/Num';
import { useMe } from '@/components/teacher/Me';
import { useReport, useFetch, type Head } from '@/components/teacher/PrintSheet';
import { ReportHead } from '@/components/teacher/ReportCards';
import {
  RosterView, AbsenceView, IncompleteView, DueView, KnightsView, HonourView,
  type RosterRow, type AbsenceRow, type IncompleteRow, type DueRow,
  type KnightRow, type HonourRow,
} from '@/components/teacher/ReportViews';
import { COPY } from '@/content/teacher';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Id = 'roster' | 'absence' | 'incomplete' | 'weekly' | 'due' | 'honour' | 'knights';

type Report = {
  id: Id;
  title: string;
  body: string;
  icon: LucideIcon;
  /** The A4 route — still there, still what a printer gets. */
  print: string;
  /** True when the sheet covers the chosen period. */
  periodic?: boolean;
  /** الورقة الأسبوعية is a blank form to fill with a pen. There is nothing to
      read on a screen: it exists for the afternoon the phone is dead. */
  paperOnly?: boolean;
  group: 'halaqa' | 'outward';
};

const REPORTS: Report[] = [
  {
    id: 'roster', title: 'كشف حلقتي', icon: Users, group: 'halaqa',
    body: 'طلابك ومستوياتهم ومقرّراتهم وآخر تسميع ونقاطهم.',
    print: '/teacher/print/roster',
  },
  {
    id: 'absence', title: 'كشف الغياب', icon: CalendarRange, group: 'halaqa', periodic: true,
    body: 'حضور طلابك في المدة، محسوبًا على أيام حلقتك وحدها.',
    print: '/teacher/print/absence',
  },
  {
    id: 'incomplete', title: 'التسميع الناقص', icon: FileText, group: 'halaqa', periodic: true,
    body: 'من تكرّر انتقاله بلا مراجعة — لتعالجه قبل أن يتراكم.',
    print: '/teacher/print/incomplete',
  },
  {
    id: 'due', title: 'المستحقون للاختبار', icon: Award, group: 'outward',
    body: 'من بلغ مقرّر الاختبار، ومواعيد المحجوز منها.',
    print: '/teacher/print/due',
  },
  {
    id: 'knights', title: 'فرسان الأسبوع', icon: ShieldCheck, group: 'outward',
    body: 'من أتمّ أسبوعه كاملًا — حضورًا وثوبًا وتسميعًا.',
    print: '/teacher/print/knights',
  },
  {
    id: 'honour', title: 'لوحة الشرف', icon: Trophy, group: 'outward',
    body: 'أعلى خمسة في النقاط — تُعلَّق في مكان الحلقة.',
    print: '/teacher/print/honour',
  },
  {
    id: 'weekly', title: 'الورقة الأسبوعية', icon: Printer, group: 'halaqa', paperOnly: true,
    body: 'ورقة فارغة تُملأ بالقلم، للاحتياط عند تعطّل الجوال.',
    print: '/teacher/print/weekly',
  },
];

function ReportsScreen() {
  const { me } = useMe();
  const sp = useSearchParams();
  const router = useRouter();

  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => iso(new Date()));

  const openId = sp.get('r') as Id | null;
  const open = REPORTS.find((r) => r.id === openId) ?? null;

  const go = (id: Id | null) =>
    router.replace(id ? `/teacher/reports?r=${id}` : '/teacher/reports', { scroll: true });

  /* ── تقرير مفتوح ─────────────────────────────────────────────────────── */
  if (open) {
    const period = open.periodic ? `from=${from}&to=${to}` : '';
    return (
      <div className="space-y-3.5">
        <button onClick={() => go(null)}
          className="flex items-center gap-1 text-xs2 text-ink-600 transition hover:text-ink-900">
          <ChevronLeft size={14} /> كل التقارير
        </button>

        {open.periodic && (
          <Sheet>
            <span className="mb-1 block text-micro text-ink-500">المدة</span>
            <DateRangeField from={from} to={to} max={iso(new Date())} label="مدة التقرير"
              onChange={(a, b) => { setFrom(a); setTo(b); }} />
          </Sheet>
        )}

        <Sheet>
          <Body report={open} period={period} />
        </Sheet>
      </div>
    );
  }

  /* ── القائمة ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-3.5">
      <Sheet>
        <SheetHead title="التقارير" meta={COPY.reportsHint} />
        {me && (
          <p className="text-xs2 text-ink-500">
            حلقتك: {me.halaqa.name} — <Num>{me.counts.roster}</Num> طالبًا.
          </p>
        )}
      </Sheet>

      <Group title="كشوف حلقتي" reports={REPORTS.filter((r) => r.group === 'halaqa')} onOpen={go} />
      <Group title="ما يُرسل ويُعلَّق" reports={REPORTS.filter((r) => r.group === 'outward')} onOpen={go} />
    </div>
  );
}

function Group({ title, reports, onOpen }: {
  title: string; reports: Report[]; onOpen: (id: Id) => void;
}) {
  return (
    <section>
      <h2 className="px-0.5 pb-2.5 text-base2 font-bold text-ink-900">{title}</h2>
      <ul className="space-y-2">
        {reports.map((r) => (
          <li key={r.id}>
            {r.paperOnly ? (
              /* لا شيء يُقرأ فيها على الشاشة — فتذهب إلى الطابعة مباشرة. */
              <Link href={r.print} target="_blank"
                className="press block rounded-2xl border border-ink-150 bg-paper px-[18px] py-3.5 shadow-soft transition-colors hover:border-brand-200">
                <Row r={r} trailing={<Printer size={16} className="text-ink-300" strokeWidth={1.9} />} />
              </Link>
            ) : (
              <button onClick={() => onOpen(r.id)}
                className="press block w-full rounded-2xl border border-ink-150 bg-paper px-[18px] py-3.5 text-start shadow-soft transition-colors hover:border-brand-200">
                <Row r={r} trailing={<ChevronLeft size={16} className="text-ink-300" strokeWidth={1.9} />} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ r, trailing }: { r: Report; trailing: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
        <r.icon size={17} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-base2 font-medium text-ink-900">
          {r.title}
          {r.periodic && <Chip tone="ink">بالمدة</Chip>}
          {r.paperOnly && <Chip tone="ink">للطباعة</Chip>}
        </p>
        <p className="mt-0.5 text-xs2 leading-relaxed text-ink-600">{r.body}</p>
      </div>
      <span className="mt-1.5 shrink-0">{trailing}</span>
    </div>
  );
}

/* ── جسم التقرير ──────────────────────────────────────────────────────────
   Each kind fetches its own shape. The four states — loading, error, empty and
   the report itself — are handled once per kind rather than once per file. */

function Body({ report, period }: { report: Report; period: string }) {
  const printHref = period ? `${report.print}?${period}` : report.print;
  const head = (
    <ReportHead title={report.title} meta={report.body}
      action={<Link href={printHref} target="_blank">
        <Btn size="sm" icon={Printer}>طباعة</Btn>
      </Link>} />
  );

  if (report.id === 'honour') return <><Honour head={head} /></>;
  return <Kind report={report} period={period} head={head} />;
}

/** الحالات الثلاث التي تسبق كل تقرير. */
function Gate({ loading, error, children }: {
  loading: boolean; error?: string; children: React.ReactNode;
}) {
  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-panel text-ink-500">
        <Loader2 size={16} className="animate-spin" /> جارٍ التحضير…
      </p>
    );
  }
  if (error) {
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-panel text-risk-700">
        <AlertTriangle size={16} /> {error}
      </p>
    );
  }
  return <>{children}</>;
}

/** المدة التي يغطّيها التقرير — تُقال، فالرقم بلا مقامه نصف خبر. */
function Covers({ d }: { d: Head | null }) {
  if (!d) return null;
  return (
    <p className="mb-3.5 text-xs2 text-ink-500">
      <Num>{toArabicDigits(formatDate(d.from))}</Num> — <Num>{toArabicDigits(formatDate(d.to))}</Num>
      {' · '}<Num>{toArabicDigits(d.halaqaDays)}</Num>{' '}
      {d.halaqaDays === 1 ? 'يوم حلقة' : 'أيام حلقة'}
    </p>
  );
}

function Kind({ report, period, head }: {
  report: Report; period: string; head: React.ReactNode;
}) {
  const kind = report.id.toUpperCase();
  const { data, error, loading } = useReport<Head & Record<string, unknown>>(kind, period);

  return (
    <>
      {head}
      <Gate loading={loading} error={error}>
        {report.periodic && <Covers d={data ?? null} />}
        {report.id === 'roster' && (
          <RosterView rows={(data?.rows ?? []) as RosterRow[]} />
        )}
        {report.id === 'absence' && (
          <AbsenceView rows={(data?.rows ?? []) as AbsenceRow[]}
            halaqaDays={data?.halaqaDays ?? 0} />
        )}
        {report.id === 'incomplete' && (
          <IncompleteView rows={(data?.rows ?? []) as IncompleteRow[]} />
        )}
        {report.id === 'due' && (
          <DueView rows={(data?.rows ?? []) as DueRow[]} />
        )}
        {report.id === 'knights' && (
          <KnightsView rows={(data?.rows ?? []) as KnightRow[]}
            considered={(data?.considered as number) ?? 0}
            halaqaDays={data?.halaqaDays ?? 0} />
        )}
      </Gate>
    </>
  );
}

/** لوحة الشرف تقرأ من دفتر النقاط لا من مسار التقارير — وتأخذ `honour` كما
    بناه الخادم لا ترتيبًا من عندها: هو الذي يعالج التساوي ويُسقط الأصفار،
    وورقة المشرف تقرأ الشيء نفسه. */
function Honour({ head }: { head: React.ReactNode }) {
  const { data, error, loading } =
    useFetch<{ honour: HonourRow[] }>('/api/teacher/points');
  const rows = data?.honour ?? [];
  return (
    <>
      {head}
      <Gate loading={loading} error={error}>
        <HonourView rows={rows} />
      </Gate>
    </>
  );
}

export default function Page() {
  return <Suspense><ReportsScreen /></Suspense>;
}
