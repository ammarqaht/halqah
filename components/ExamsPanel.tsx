'use client';
/* The panel for الاختبارات — DESIGN.md §4 specifies «Booking queue for the day,
   and exam-type filter». The booking queue belongs to إد-٥-ج (the on-site exam
   screen) and does not exist yet, so it is **absent rather than empty**: the
   product's rule is that something which cannot be computed is not shown as a
   zero. It appears here when its screen ships. */
import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PanelShell, PanelGroup, PanelItem } from '@/components/Panel';
import { plural } from '@/components/Num';
import { useDB } from '@/lib/store';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { type BookingBadge } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { isoDate } from '@/lib/dates';

const TYPES: ExamType[] = ['BADGE_GOLDEN', 'BADGE_DIAMOND', 'ASSOCIATION', 'MOCK', 'TAJWEED'];

/* دفتر المواعيد يُقرأ بسؤال في الذهن: من يجلس اليوم، وما بقي مفتوحًا، وما أُجري.
   «خيارات التصفية تكون في البار الجانبي وليس فوق» (client, 18 Sep 2026) — and
   the side panel is where every other screen keeps them (DESIGN.md §4), so the
   table gets its width back and the filters sit where the eye already looks for
   them. They live in the URL, so a cut of the book is a link. */
const WHEN: { id: string; label: string }[] = [
  { id: 'done', label: 'أُجري' },
  { id: 'today', label: 'اليوم' },
  { id: 'booked', label: 'محجوز' },
  { id: 'cancelled', label: 'أُلغي' },
];
const BADGES: BookingBadge[] = ['BADGE_GOLDEN', 'BADGE_DIAMOND', 'ASSOCIATION'];

export function ExamsPanel({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const path = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const set = (key: string, val: string | null, path = '/admin/exams') => {
    const next = new URLSearchParams(sp.toString());
    if (val === null || next.get(key) === val) next.delete(key); else next.set(key, val);
    router.replace(`${path}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const counts = useMemo(() => {
    const byType = new Map<string, number>();
    const byHalaqa = new Map<string, number>();
    let unpaid = 0;
    for (const e of db.exams) {
      byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
      if (e.halaqaId) byHalaqa.set(e.halaqaId, (byHalaqa.get(e.halaqaId) ?? 0) + 1);
      if (e.passed === true && e.pointsAwarded > 0 && !e.pointsPaid) unpaid++;
    }
    return { byType, byHalaqa, unpaid };
  }, [db.exams]);

  /* DESIGN.md §4 promised a booking queue here; it was absent while إد-٥-ج did
     not exist. Now it can be computed, so it appears. */
  const dueToday = useMemo(() => {
    const today = new Date();
    const iso = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'),
                 String(today.getDate()).padStart(2, '0')].join('-');
    return db.bookings.filter((b) => b.scheduledOn === iso && b.status === 'BOOKED').length;
  }, [db.bookings]);

  const type = sp.get('type');
  const halaqa = sp.get('halaqa');
  const onLog = path === '/admin/exams';
  const onBook = path.startsWith('/admin/exams/onsite');

  /* The same four cuts the screen applies, counted here so the shape of the
     book is readable before anything is clicked — and a cut with nothing in it
     is still shown, because «لا شيء ألغي» is an answer. */
  const today = isoDate(new Date());
  const book = useMemo(() => ({
    all: db.bookings.length,
    done: db.bookings.filter((b) => b.status === 'DONE').length,
    today: db.bookings.filter((b) => b.status === 'BOOKED' && b.scheduledOn === today).length,
    booked: db.bookings.filter((b) => b.status === 'BOOKED').length,
    cancelled: db.bookings.filter((b) => b.status === 'CANCELLED').length,
    byBadge: (x: string) => db.bookings.filter((b) => b.badge === x).length,
  }), [db.bookings, today]);
  const when = sp.get('when');
  const badge = sp.get('badge');

  return (
    <PanelShell title="الاختبارات"
      meta={db.exams.length
        ? plural(db.exams.length, 'اختبار واحد مسجَّل', 'اختباران مسجَّلان', 'اختبارات مسجَّلة', 'اختبارًا مسجَّلًا')
        : 'لا اختبارات بعد'}
      onClose={onClose}>

      <PanelGroup label="الشاشات">
        <PanelItem active={onLog} onClick={() => router.push('/admin/exams')}
          count={db.exams.length || undefined}>سجلّ الاختبارات</PanelItem>
        <PanelItem active={path.startsWith('/admin/exams/new')}
          onClick={() => router.push('/admin/exams/new')}>تسجيل اختبار</PanelItem>
        <PanelItem active={path.startsWith('/admin/exams/onsite')}
          onClick={() => router.push('/admin/exams/onsite')}
          count={dueToday || undefined}
          tone={dueToday > 0 ? 'warn' : undefined}>حجوزات الاختبارات</PanelItem>
      </PanelGroup>

      {onBook && db.bookings.length > 0 && (
        <>
          <PanelGroup label="الوقت">
            <PanelItem active={!when} onClick={() => set('when', null, '/admin/exams/onsite')}
              count={book.all}>الكل</PanelItem>
            {WHEN.map((w) => (
              <PanelItem key={w.id} active={when === w.id}
                onClick={() => set('when', w.id, '/admin/exams/onsite')}
                count={book[w.id as 'done' | 'today' | 'booked' | 'cancelled']}
                tone={w.id === 'today' && book.today > 0 ? 'warn' : undefined}>
                {w.label}
              </PanelItem>
            ))}
          </PanelGroup>

          <PanelGroup label="الوسام">
            <PanelItem active={!badge} onClick={() => set('badge', null, '/admin/exams/onsite')}>
              كل الأوسمة
            </PanelItem>
            {BADGES.map((b) => (
              <PanelItem key={b} active={badge === b}
                onClick={() => set('badge', b, '/admin/exams/onsite')}
                count={book.byBadge(b) || undefined}>
                {EXAM_TYPE_AR[b]}
              </PanelItem>
            ))}
          </PanelGroup>
        </>
      )}

      {onLog && db.exams.length > 0 && (
        <>
          {counts.unpaid > 0 && (
            <PanelGroup label="يحتاج تدخّلك">
              <PanelItem tone="warn" count={counts.unpaid}
                onClick={() => set('type', null)}>اجتاز ولم تُصرف نقاطه</PanelItem>
            </PanelGroup>
          )}

          <PanelGroup label="نوع الاختبار">
            <PanelItem active={!type} onClick={() => set('type', null)} count={db.exams.length}>
              كل الأنواع
            </PanelItem>
            {TYPES.map((t) => {
              const n = counts.byType.get(t) ?? 0;
              if (!n) return null;               // a type never used is not a zero row
              return (
                <PanelItem key={t} active={type === t} onClick={() => set('type', t)} count={n}>
                  {EXAM_TYPE_AR[t]}
                </PanelItem>
              );
            })}
          </PanelGroup>

          {counts.byHalaqa.size > 0 && (
            <PanelGroup label="الحلقات">
              <PanelItem active={!halaqa} onClick={() => set('halaqa', null)}>كل الحلقات</PanelItem>
              {db.halaqat.map((h) => {
                const n = counts.byHalaqa.get(h.id) ?? 0;
                if (!n) return null;
                return (
                  <PanelItem key={h.id} active={halaqa === h.id}
                    onClick={() => set('halaqa', h.id)} count={n} sub={h.timeSlot}>
                    {shortName(h.teacher)}
                  </PanelItem>
                );
              })}
            </PanelGroup>
          )}
        </>
      )}

    </PanelShell>
  );
}
