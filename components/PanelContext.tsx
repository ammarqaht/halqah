'use client';
/* The panel's content is chosen by section. Each section gets a surface built
   for its own work — a jump list here, a live filter surface there. DESIGN.md §4. */
import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { PanelShell, PanelGroup, PanelItem, AlertItem } from '@/components/Panel';
import { Num } from '@/components/Num';
import { StudentsPanel } from '@/components/StudentsPanel';
import { PointsPanel } from '@/components/PointsPanel';
import { ExamsPanel } from '@/components/ExamsPanel';
import { FollowUpPanel } from '@/components/FollowUpPanel';
import { ReportsPanel } from '@/components/ReportsPanel';
import { PlansPanel } from '@/components/PlansPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useDB } from '@/lib/store';
import { derive } from '@/lib/derive';
import { followUpRows, followedRows, listCounts, dueForExamCount } from '@/lib/followup';
import { isLowStock } from '@/lib/points';

type Alert = {
  id: string; tone: 'risk' | 'warn' | 'ok'; count: number; label: string; href: string;
};
const HIDDEN_KEY = 'halqah.admin.hiddenAlerts.v1';

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
      dueExams: dueForExamCount(db.bookings),
      readyCount: counts.ready,
      lateCount: counts.late,
      overdueCount: counts.overdue,
    };
  }, [db, isOverview]);

  /* Every alert the overview can raise, in the order they are shown. A booked
     sitting whose day has come is the one alert the supervisor made himself,
     so it sits above the inferred ones. An alert at zero is absent, never a 0. */
  const live = useMemo<Alert[]>(() => {
    if (!overview || overview.d.isEmpty) return [];
    const o = overview;
    const all: Alert[] = [
      { id: 'orphans', tone: 'risk', count: o.d.orphans, label: 'طالب بلا حلقة', href: '/admin/students?halaqa=none' },
      { id: 'flagged', tone: 'warn', count: o.d.flagged, label: 'رقم هوية يحتاج مراجعة', href: '/admin/students' },
      { id: 'due', tone: 'risk', count: o.dueExams, label: 'حان موعد اختباره', href: '/admin/exams/onsite' },
      { id: 'ready', tone: 'ok', count: o.readyCount, label: 'جاهز لاختبار الجمعية', href: '/admin/follow-up?list=ready' },
      { id: 'late', tone: 'warn', count: o.lateCount, label: 'تأخّر في مستواه', href: '/admin/follow-up?list=late' },
      { id: 'overdue', tone: 'risk', count: o.overdueCount, label: 'لم يُختبر مؤخرًا', href: '/admin/follow-up?list=unexamined' },
      { id: 'orders', tone: 'warn', count: o.pendingOrders, label: 'طلبات بانتظار التسليم', href: '/admin/store?status=PENDING' },
      { id: 'stock', tone: 'warn', count: o.lowStockGifts, label: 'هدية قاربت على النفاد', href: '/admin/store' },
    ];
    return all.filter((a) => a.count > 0);
  }, [overview]);

  /* Hiding is «I have seen this», not «never tell me again»: the eye stores
     the count it was hidden at, and the alert returns by itself when that
     count grows — a new boy late on his level is news again. Per device, in
     this browser; it is a view preference, not a record. */
  const [hidden, setHidden] = useState<Record<string, number>>({});
  useEffect(() => {
    try { setHidden(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '{}') ?? {}); } catch { /* private mode */ }
  }, []);
  const saveHidden = (h: Record<string, number>) => {
    setHidden(h);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(h)); } catch { /* private mode */ }
  };
  const hide = (id: string, count: number) => saveHidden({ ...hidden, [id]: count });
  const showAll = () => saveHidden({});
  /* A count that FALLS lowers the mark, so «returns when it grows» means
     grows from where it is now: hidden at 5, down to 2, up to 4 is news. */
  useEffect(() => {
    const lower = live.filter((a) => a.id in hidden && a.count < hidden[a.id]);
    if (lower.length) saveHidden({ ...hidden, ...Object.fromEntries(lower.map((a) => [a.id, a.count])) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  const visible = live.filter((a) => !(a.id in hidden) || a.count > hidden[a.id]);
  const hiddenCount = live.length - visible.length;

  if (path.startsWith('/admin/students')) return <StudentsPanel onClose={onClose} />;
  if (path.startsWith('/admin/exams')) return <ExamsPanel onClose={onClose} />;
  if (path.startsWith('/admin/plans')) return <PlansPanel onClose={onClose} />;
  if (path.startsWith('/admin/settings')) return <SettingsPanel onClose={onClose} />;
  /* Two sections, two panels. Sharing one made the follow-up lists appear
     while printing and the report picker appear while following up. */
  if (path.startsWith('/admin/reports')) return <ReportsPanel onClose={onClose} />;
  if (path.startsWith('/admin/follow-up')) {
    return <FollowUpPanel onClose={onClose} />;
  }
  if (path.startsWith('/admin/points') || path.startsWith('/admin/store')) {
    return <PointsPanel onClose={onClose} />;
  }

  if (overview) {
    const { d } = overview;
    return (
      <PanelShell title="ما يحتاج تدخّلك"
        meta={d.sourceFile ? `آخر ملف: ${d.sourceFile}` : 'لم يُرفع ملف بعد'} onClose={onClose}>
        {d.isEmpty ? (
          <p className="px-1.5 py-2 text-panel leading-relaxed text-ink-500">
            لا توجد تنبيهات لأن القاعدة فارغة. ابدأ برفع ملفاتك.
          </p>
        ) : (
          <PanelGroup label="تنبيهات">
            {visible.map((a, n) => (
              <AlertItem key={a.id} tone={a.tone} count={a.count}
                tour={n === 0 ? 'alert-row' : undefined}
                onGo={() => router.push(a.href)} onHide={() => hide(a.id, a.count)}>
                {a.label}
              </AlertItem>
            ))}
            {live.length === 0 && (
              <p className="px-1.5 py-2 text-panel text-ink-500">لا شيء يحتاج تدخّلك الآن.</p>
            )}
            {live.length > 0 && visible.length === 0 && (
              <p className="px-1.5 py-2 text-panel text-ink-500">أخفيت كل التنبيهات.</p>
            )}
            {hiddenCount > 0 && (
              <button onClick={showAll}
                className="mt-1 flex items-center gap-1.5 rounded px-1.5 py-1 text-micro text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800">
                <Eye size={13} strokeWidth={1.9} aria-hidden />
                إظهار المخفية (<Num>{hiddenCount}</Num>)
              </button>
            )}
          </PanelGroup>
        )}

        <PanelGroup label="اختصارات">
          <PanelItem onClick={() => router.push('/admin/students')}>الطلاب والحلقات</PanelItem>
          <PanelItem onClick={() => router.push('/admin/points')}>شحن نقاط</PanelItem>
          <PanelItem onClick={() => router.push('/admin/points/codes')}>إصدار أكواد</PanelItem>
          <PanelItem onClick={() => router.push('/admin/plans')}>طباعة خطة لطالب</PanelItem>
          <PanelItem onClick={() => router.push('/admin/exams')}>تسجيل اختبار</PanelItem>
          {/* «أبي زرّ رسالة للمعلمين والطلاب تكون ضمن الاختصارات» (client,
              18 Sep 2026) — it is a destination like the five above it, not an
              action on the screen the bar belongs to. */}
          <PanelItem onClick={() => router.push('/admin/settings?s=messages')}>
            رسالة للمعلمين والطلاب
          </PanelItem>
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
