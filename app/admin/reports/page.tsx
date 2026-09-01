'use client';
/* التقارير — SPEC.md §6.11, approved PDF §9 (إد-٥-هـ).
   The hub: every phase-1 report from one screen. Each printed report is a
   `/print/*` route (DESIGN.md §8); this screen only chooses the scope —
   which student, which halaqa, which period — and opens the sheet.
   The two reports that live inside their own workflows (ورقة الخطة، بطاقات
   الأكواد) link to their screens rather than duplicating them here. */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Printer, FileText, Users, Landmark, Award, Coins, Trophy, PackageCheck,
  QrCode, Inbox,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty, Segmented, INPUT, Field } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Count } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { useDB } from '@/lib/store';
import { followUpRows, followedRows, listRows } from '@/lib/followup';
import { TRACK_AR } from '@/lib/types';
import { shortName, teacherName } from '@/lib/normalise';
import { cx } from '@/lib/cx';
import type { LucideIcon } from 'lucide-react';

function ReportCard({ icon: Ico, title, body, assoc, children }:
  { icon: LucideIcon; title: string; body: string; assoc?: boolean; children: React.ReactNode }) {
  return (
    <Sheet className="flex flex-col">
      <div className="mb-4 flex items-start gap-3">
        <span className={cx('rounded-lg p-2',
          assoc ? 'bg-assoc-100 text-assoc-900' : 'bg-brand-100 text-brand-800')}>
          <Ico size={18} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg2 font-bold text-ink-900">{title}</h2>
          <p className="mt-0.5 text-xs2 text-ink-500">{body}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-end gap-3">{children}</div>
    </Sheet>
  );
}

export default function Page() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const router = useRouter();

  const [studentId, setStudentId] = useState('');
  const [halaqaFor, setHalaqaFor] = useState<Record<string, string>>({});
  const [statsMode, setStatsMode] = useState<'all' | 'period'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const readyCount = useMemo(
    () => listRows(followedRows(followUpRows(db)), 'ready').length, [db]);

  const studentOptions = useMemo(() => db.students
    .filter((s) => s.status === 'ACTIVE')
    .map((s) => ({
      value: s.id, label: s.fullName,
      hint: [teacherName(db.halaqat, s.halaqaId, 'بلا حلقة'),
             s.track ? TRACK_AR[s.track] : 'بلا مسار'].join(' · '),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar')),
  [db.students, db.halaqat]);
  const halaqaOptions = useMemo(() => db.halaqat.map((h) => ({
    value: h.id, label: shortName(h.teacher), hint: h.timeSlot,
  })), [db.halaqat]);

  /** One halaqa pick per card, so choosing for one report does not move another. */
  const halaqaPick = (key: string, extra?: { value: string; label: string }) => (
    <div className="min-w-[13rem] flex-1">
      <Combobox value={halaqaFor[key] ?? extra?.value ?? ''} placeholder="اختر الحلقة…"
        onChange={(v) => setHalaqaFor((m) => ({ ...m, [key]: v }))}
        options={extra ? [extra, ...halaqaOptions] : halaqaOptions} />
    </div>
  );

  const statsHref = statsMode === 'period'
    ? `/print/association?${new URLSearchParams({
        ...(from ? { from } : {}), ...(to ? { to } : {}) })}`
    : '/print/association';

  if (!db.students.length) {
    return (
      <>
        <TopBar title="التقارير" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا بيانات تُطبع بعد"
              body="التقارير الثمانية تُبنى من قاعدة البيانات لحظة الطباعة. ابدأ برفع ملف الطلاب."
              action={<Link href="/admin/students/import">
                <Btn variant="primary" size="lg">رفع ملف</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="التقارير" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <div className="rise grid gap-4 lg:grid-cols-2">

          <ReportCard icon={FileText} title="التقرير الشامل للطالب"
            body="بياناته، مستواه وخطته، اختباراته كلها، رصيده وآخر حركاته، ولقطة رتل — صفحة واحدة لملفه أو لوليّ أمره.">
            <div className="min-w-[13rem] flex-1">
              <Combobox value={studentId} onChange={setStudentId}
                options={studentOptions} placeholder="اختر طالبًا…" searchPlaceholder="ابحث بالاسم…" />
            </div>
            <Btn variant="primary" icon={Printer} disabled={!studentId}
              onClick={() => router.push(`/print/student/${studentId}`)}>طباعة</Btn>
          </ReportCard>

          <ReportCard icon={Users} title="تقرير حلقة المعلّم"
            body="كشف الحلقة كاملًا — ومن اختبرته الجمعية صفّه مظلَّل مع ✓، بديل التظليل الأخضر اليدوي.">
            {halaqaPick('halaqa')}
            <Btn variant="primary" icon={Printer} disabled={!halaqaFor.halaqa}
              onClick={() => router.push(`/print/halaqa/${halaqaFor.halaqa}`)}>طباعة</Btn>
          </ReportCard>

          <ReportCard icon={Landmark} assoc title="إحصاءات الجمعية"
            body="الأعداد والمسارات والمراحل والجنسيات وحصيلة الاختبارات — تراكميًا، أو محصورة بفترة.">
            <Segmented value={statsMode} onChange={setStatsMode}
              options={[{ value: 'all', label: 'تراكمي' }, { value: 'period', label: 'فترة' }]} />
            {statsMode === 'period' && (
              <>
                <Field label="من">
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                    className={cx(INPUT, 'h-9 w-40')} />
                </Field>
                <Field label="إلى">
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                    className={cx(INPUT, 'h-9 w-40')} />
                </Field>
              </>
            )}
            <Btn variant="primary" icon={Printer}
              disabled={statsMode === 'period' && !from && !to}
              onClick={() => router.push(statsHref)}>طباعة</Btn>
          </ReportCard>

          <ReportCard icon={Award} assoc title="كشف الجاهزين لاختبار الجمعية"
            body="من أتمّ الجزء واجتاز الوسام الماسي عليه — برقم الهوية كاملًا وعمود ملاحظات لمختبِر الجمعية.">
            {halaqaPick('ready', { value: 'all', label: 'كل الحلقات' })}
            <Btn variant="primary" icon={Printer}
              onClick={() => {
                const h = halaqaFor.ready;
                router.push(h && h !== 'all' ? `/print/ready?halaqa=${h}` : '/print/ready');
              }}>
              طباعة
            </Btn>
            <p className="w-full text-micro text-ink-500">
              {readyCount
                ? <>في الكشف الآن <Count n={readyCount} one="طالب واحد" two="طالبان" few="طلاب" many="طالبًا" /></>
                : 'الكشف فارغ حاليًا — يمتلئ فور اجتياز وسام ماسي على جزء مكتمل.'}
            </p>
          </ReportCard>

          <ReportCard icon={Coins} title="قائمة نقاط الحلقة"
            body="أرصدة حلقة واحدة بخط كبير — تُعلَّق في الحلقة أو تُمسك عند باب المتجر.">
            {halaqaPick('points')}
            <Btn variant="primary" icon={Printer} disabled={!halaqaFor.points}
              onClick={() => router.push(`/print/points/${halaqaFor.points}`)}>طباعة</Btn>
          </ReportCard>

          <ReportCard icon={Trophy} title="لوحة الشرف"
            body="أعلى عشرة أرصدة — للجامع كله أو لحلقة واحدة، بخط يُقرأ من بعيد.">
            {halaqaPick('honour', { value: 'all', label: 'كل الحلقات' })}
            <Btn variant="primary" icon={Printer}
              onClick={() => {
                const h = halaqaFor.honour;
                router.push(h && h !== 'all' ? `/print/honour?halaqa=${h}` : '/print/honour');
              }}>
              طباعة
            </Btn>
          </ReportCard>

          <ReportCard icon={PackageCheck} title="قائمة تسليم الهدايا"
            body="الطلبات المنتظرة مرتّبة للتسليم على الطاولة — تُشطب ورقيًا ثم تُسلَّم في الشاشة.">
            <Link href="/print/pick-list"><Btn variant="primary" icon={Printer}>طباعة</Btn></Link>
          </ReportCard>

          <ReportCard icon={QrCode} title="ورقة الخطة · بطاقات الأكواد"
            body="لكلٍّ منهما شاشته: الخطة تُطبع من شاشة الخطط وتُسجَّل بالطباعة، والبطاقات من شاشة الأكواد.">
            <Link href="/admin/plans"><Btn icon={FileText}>شاشة الخطط</Btn></Link>
            <Link href="/admin/points/codes"><Btn icon={QrCode}>شاشة الأكواد</Btn></Link>
          </ReportCard>

        </div>
      </div>
    </>
  );
}
