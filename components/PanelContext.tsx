'use client';
/* The panel's content is chosen by section. Each section gets a surface built
   for its own work — a jump list here, a live filter surface there. DESIGN.md §4. */
import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { StudentsPanel } from '@/components/StudentsPanel';
import { PointsPanel } from '@/components/PointsPanel';
import { ExamsPanel } from '@/components/ExamsPanel';
import { FollowUpPanel } from '@/components/FollowUpPanel';
import { useDB } from '@/lib/store';
import { derive } from '@/lib/derive';
import { followUpRows, followedRows, listCounts } from '@/lib/followup';
import { isLowStock } from '@/lib/points';

export function PanelContext({ onClose }: { onClose: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const db = useDB();
  const isOverview = path === '/admin';

  /* Every figure below belongs to the overview alone, so it is computed only
     there — the panel re-renders on every store commit whatever section is
     open, and paying full-roster aggregations on a section that never shows
     them is pure waste. (Hooks must run before the early returns, hence the
     gate lives INSIDE the memo rather than around it.) */
  const overview = useMemo(() => {
    if (!isOverview) return null;
    const d = derive(db);
    /* SPEC §6.1's alert table: «Late on level», «Ready for association» and
       «Not examined in N days» were deferred until the tables behind them
       existed; phases 4–5 built those tables, so they are computed now — and
       an alert that IS computable but zero stays absent, like the rest. */
    const counts = listCounts(followedRows(followUpRows(db)));
    return {
      d,
      pendingOrders: db.orders.filter((o) => o.status === 'PENDING').length,
      lowStockGifts: db.gifts.filter(isLowStock).length,
      readyCount: counts.ready,
      lateCount: counts.late,
      overdueCount: counts.overdue,
    };
  }, [db, isOverview]);

  if (path.startsWith('/admin/students')) return <StudentsPanel onClose={onClose} />;
  if (path.startsWith('/admin/exams')) return <ExamsPanel onClose={onClose} />;
  if (path.startsWith('/admin/follow-up') || path.startsWith('/admin/reports')) {
    return <FollowUpPanel onClose={onClose} />;
  }
  if (path.startsWith('/admin/points') || path.startsWith('/admin/store')) {
    return <PointsPanel onClose={onClose} />;
  }

  if (overview) {
    const { d, pendingOrders, lowStockGifts, readyCount, lateCount, overdueCount } = overview;
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
            {/* SPEC.md §6.1 lists both of these against phase 6, and phase 6 is
                now built, so they can finally be computed rather than promised.
                An alert that cannot be computed stays absent; it is never a zero. */}
            {readyCount > 0 && (
              <PanelItem tone="ok" count={readyCount}
                onClick={() => router.push('/admin/follow-up?list=ready')}>جاهز لاختبار الجمعية</PanelItem>
            )}
            {lateCount > 0 && (
              <PanelItem tone="warn" count={lateCount}
                onClick={() => router.push('/admin/follow-up?list=late')}>تأخّر في مستواه</PanelItem>
            )}
            {overdueCount > 0 && (
              <PanelItem tone="risk" count={overdueCount}
                onClick={() => router.push('/admin/follow-up?list=unexamined')}>لم يُختبر مؤخرًا</PanelItem>
            )}
            {pendingOrders > 0 && (
              <PanelItem tone="warn" count={pendingOrders}
                onClick={() => router.push('/admin/store?status=PENDING')}>طلبات بانتظار التسليم</PanelItem>
            )}
            {lowStockGifts > 0 && (
              <PanelItem tone="warn" count={lowStockGifts}
                onClick={() => router.push('/admin/store')}>هدية قاربت على النفاد</PanelItem>
            )}
            {d.orphans === 0 && d.flagged === 0 && pendingOrders === 0 && lowStockGifts === 0
              && readyCount === 0 && lateCount === 0 && overdueCount === 0 && (
              <p className="px-1.5 py-2 text-panel text-ink-500">لا شيء يحتاج تدخّلك الآن.</p>
            )}
          </PanelGroup>
        )}

        <PanelGroup label="اختصارات">
          <PanelItem onClick={() => router.push('/admin/students/import')}>رفع ملف</PanelItem>
          <PanelItem onClick={() => router.push('/admin/students')}>الطلاب والحلقات</PanelItem>
          <PanelItem onClick={() => router.push('/admin/points')}>شحن نقاط</PanelItem>
          <PanelItem onClick={() => router.push('/admin/points/codes')}>إصدار أكواد</PanelItem>
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
