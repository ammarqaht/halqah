'use client';
/* The panel's content is chosen by section. Each section gets a surface built
   for its own work — a jump list here, a live filter surface there. DESIGN.md §4. */
import { usePathname, useRouter } from 'next/navigation';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { StudentsPanel } from '@/components/StudentsPanel';
import { useDB } from '@/lib/store';
import { derive } from '@/lib/derive';

export function PanelContext({ onClose }: { onClose: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const d = derive(useDB());

  if (path.startsWith('/admin/students')) return <StudentsPanel onClose={onClose} />;

  if (path === '/admin') {
    return (
      <PanelShell title="ما يحتاج تدخّلك"
        meta={d.sourceFile ? `آخر ملف: ${d.sourceFile}` : 'لم يُرفع ملف بعد'} onClose={onClose}>
        {d.isEmpty ? (
          <p className="px-1.5 py-2 text-panel leading-relaxed text-ink-500">
            لا توجد تنبيهات لأن القاعدة فارغة. ابدأ برفع ملف رتل.
          </p>
        ) : (
          <PanelGroup label="تنبيهات">
            {d.orphans > 0 && (
              <PanelItem tone="risk" count={d.orphans}
                onClick={() => router.push('/admin/students?halaqa=none')}>طالب بلا حلقة</PanelItem>
            )}
            {d.flagged > 0 && (
              <PanelItem tone="warn" count={d.flagged}
                onClick={() => router.push('/admin/students')}>رقم هوية يحتاج مراجعة</PanelItem>
            )}
            {d.orphans === 0 && d.flagged === 0 && (
              <p className="px-1.5 py-2 text-panel text-ink-500">لا شيء يحتاج تدخّلك الآن.</p>
            )}
          </PanelGroup>
        )}

        <PanelGroup label="اختصارات">
          <PanelItem onClick={() => router.push('/admin/students/import')}>رفع ملف</PanelItem>
          <PanelItem onClick={() => router.push('/admin/students')}>الطلاب والحلقات</PanelItem>
          <PanelItem onClick={() => router.push('/admin/plans')}>طباعة خطة لطالب</PanelItem>
          <PanelItem onClick={() => router.push('/admin/exams')}>تسجيل اختبار</PanelItem>
        </PanelGroup>
      </PanelShell>
    );
  }

  return (
    <PanelShell title="اللوحة" meta="تتبدّل بحسب القسم" onClose={onClose}>
      <p className="px-1.5 py-2 text-panel leading-relaxed text-ink-500">
        هذه اللوحة تتشكّل حسب الشاشة المفتوحة. تُبنى مع شاشتها في خطة البناء.
      </p>
    </PanelShell>
  );
}
