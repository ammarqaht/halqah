'use client';
/* التقارير — the panel chooses, this shows. §إد-٥-هـ
   The sheet is rendered inside an A4 frame at the size it will print, so what
   is on screen is what comes out of the printer. Choosing blind and printing
   to find out is how a supervisor ends up printing everything twice. */
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ExternalLink, Inbox, MousePointerClick } from 'lucide-react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty } from '@/components/ui';
import { usePanel } from '@/components/PanelState';
import { REPORTS, type ReportId } from '@/components/ReportsPanel';
import { useDB } from '@/lib/store';
import { shortName } from '@/lib/normalise';

/** Where each report actually lives, once its choices are filled in. */
function printHref(id: ReportId, halaqa: string, student: string): string | null {
  switch (id) {
    case 'halaqa':      return halaqa ? `/print/halaqa/${halaqa}` : null;
    case 'student':     return student ? `/print/student/${student}` : null;
    case 'points':      return halaqa ? `/print/points/${halaqa}` : null;
    case 'association': return '/print/association';
    case 'ready':       return halaqa ? `/print/ready?halaqa=${halaqa}` : '/print/ready';
    case 'honour':      return halaqa ? `/print/honour?halaqa=${halaqa}` : '/print/honour';
    case 'pick-list':   return '/print/pick-list';
    case 'bookings':    return '/print/bookings';
    default:            return null;
  }
}

function ReportsScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();

  const id = (sp.get('r') as ReportId) || 'halaqa';
  const report = REPORTS.find((r) => r.id === id) ?? REPORTS[0];
  const halaqa = sp.get('halaqa') ?? '';
  const student = sp.get('student') ?? '';
  const href = printHref(id, halaqa, student);

  const subject = useMemo(() => {
    if (report.needs === 'halaqa') {
      const h = db.halaqat.find((x) => x.id === halaqa);
      return h ? `حلقة ${shortName(h.teacher)}` : report.optional ? 'كل الحلقات' : null;
    }
    if (report.needs === 'student') {
      return db.students.find((x) => x.id === student)?.fullName ?? null;
    }
    return 'كل الحلقات';
  }, [report, halaqa, student, db]);

  if (!db.students.length) {
    return (
      <>
        <TopBar title="التقارير" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا توجد بيانات بعد"
              body="التقارير تُبنى من بياناتك — ارفع ملفًا من الصفحة الرئيسية أولًا."
              action={<Link href="/admin"><Btn variant="primary" size="lg">الصفحة الرئيسية</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={report.label} crumbs={subject ? [subject] : undefined}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={
          <div className="flex items-center gap-2">
            {href && (
              <a href={href} target="_blank" rel="noreferrer">
                <Btn icon={ExternalLink}>فتح في نافذة</Btn>
              </a>
            )}
            <Btn variant="primary" icon={Printer} disabled={!href}
              onClick={() => {
                const f = document.getElementById('report-frame') as HTMLIFrameElement | null;
                f?.contentWindow?.focus();
                f?.contentWindow?.print();
              }}>
              طباعة
            </Btn>
          </div>} />

      <div className="px-6 py-6 pb-16">
        {!href ? (
          <Sheet className="rise mx-auto max-w-column">
            <Empty icon={MousePointerClick}
              title={report.needs === 'student' ? 'اختر طالبًا' : 'اختر حلقة'}
              body={`«${report.label}» يحتاج ${report.needs === 'student' ? 'طالبًا بعينه' : 'حلقة بعينها'} — اختره من اللوحة على اليمين، فتظهر المعاينة هنا.`} />
          </Sheet>
        ) : (
          /* A4 at its real proportions (794 × 1123), scaled to fit the column.
             Rendering the print route itself means the preview cannot drift
             from the sheet: they are the same page. */
          <div className="rise mx-auto w-full max-w-[860px]">
            <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-soft">
              <iframe id="report-frame" key={href} src={href} title={report.label}
                className="block h-[1123px] w-full border-0 bg-white" />
            </div>
            <p className="mt-3 text-center text-micro text-ink-500">
              هذه الصفحة نفسها هي ما يُطبع — بمقاس A4.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() { return <Suspense><ReportsScreen /></Suspense>; }
