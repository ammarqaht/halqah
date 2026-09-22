'use client';
/* كل تقرير كما يُقرأ على جوّال — لا كما يُطبع على ورقة.
 *
 * One view per report kind. They share `ReportCards`, so a figure that means
 * the same thing in two reports looks the same in both; what differs is which
 * figures each carries and what order the students come in.
 *
 * ORDER IS THE VIEW'S OPINION, and on a phone it is most of its value: a
 * teacher scrolling twenty-five cards sees the first three and acts on them. So
 * whoever is flagged, absent, stuck or waiting comes first — and where nothing
 * is wrong, the order is the roster's own.
 */
import Link from 'next/link';
import { Award, CalendarX, ShieldCheck, Trophy, Users, FileText } from 'lucide-react';
import { Empty } from '@/components/ui';
import { Num, toArabicDigits } from '@/components/Num';
import { StudentCard, Stat, OutOf, When, Flag } from '@/components/teacher/ReportCards';
import { cx } from '@/lib/cx';

/* ── كشف حلقتي ──────────────────────────────────────────────────────────── */

export type RosterRow = {
  id: string; fullName: string; trackAr: string;
  level: number | null; assignmentNo: number | null; assignmentOf: number;
  lastRecitedOn: string | null; balance: number | null;
  daysOnLevel: number | null; lateOnLevel: boolean;
  lastExamAr: string | null; lastExamOn: string | null; lastExamPassed: boolean | null;
};

export function RosterView({ rows }: { rows: RosterRow[] }) {
  if (!rows.length) {
    return <Empty icon={Users} title="لا طلاب" body="لا طلاب في حلقتك بعد." />;
  }
  /* المتأخر على ورقته أولًا — وهو السؤال الذي يُحمل هذا الكشف لأجله. */
  const sorted = [...rows].sort((a, b) =>
    Number(b.lateOnLevel) - Number(a.lateOnLevel)
    || (b.daysOnLevel ?? 0) - (a.daysOnLevel ?? 0));

  return (
    <ul className="space-y-2.5">
      {sorted.map((r) => (
        <StudentCard key={r.id} name={r.fullName} tone={r.lateOnLevel ? 'warn' : undefined}
          sub={r.trackAr}
          badge={r.lateOnLevel ? <Flag tone="warn">متأخر على ورقته</Flag> : undefined}
          stats={<>
            <Stat label="المستوى" big
              value={r.level != null ? <Num>{toArabicDigits(r.level)}</Num>
                : <span className="text-ink-400">—</span>} />
            <Stat label="المقرّر"
              value={r.assignmentNo != null && r.assignmentOf > 0
                ? <OutOf n={r.assignmentNo} of={r.assignmentOf} />
                : <span className="text-ink-400">—</span>} />
            <Stat label="على الورقة" tone={r.lateOnLevel ? 'warn' : 'ink'}
              value={r.daysOnLevel != null
                ? <><Num>{toArabicDigits(r.daysOnLevel)}</Num>
                    <span className="text-panel font-normal text-ink-400"> يومًا</span></>
                : <span className="text-ink-400">—</span>} />
            <Stat label="آخر تسميع" value={<When iso={r.lastRecitedOn} />} />
            {r.lastExamAr && (
              <Stat label="آخر اختبار" tone={r.lastExamPassed === false ? 'risk' : 'ink'}
                value={<span className="text-base2">{r.lastExamAr}</span>} />
            )}
            {r.balance != null && (
              <Stat label="نقاطه" tone="brand" value={<Num>{toArabicDigits(r.balance)}</Num>} />
            )}
          </>}>
          <Link href={`/teacher/students/${r.id}`}
            className="mt-3 inline-block text-xs2 text-brand-800 hover:underline">
            ملفه ←
          </Link>
        </StudentCard>
      ))}
    </ul>
  );
}

/* ── كشف الغياب ─────────────────────────────────────────────────────────── */

export type AbsenceRow = {
  id: string; fullName: string;
  registered: number; present: number; late: number; absent: number;
  unregistered: number; streak: number; flagged: boolean;
};

export function AbsenceView({ rows, halaqaDays }: { rows: AbsenceRow[]; halaqaDays: number }) {
  if (!rows.length) return <Empty icon={CalendarX} title="لا طلاب" body="لا طلاب في حلقتك بعد." />;

  /* من بلغ حدّ التنبيه، ثم الأكثر غيابًا. */
  const sorted = [...rows].sort((a, b) =>
    Number(b.flagged) - Number(a.flagged) || b.absent - a.absent);

  return (
    <ul className="space-y-2.5">
      {sorted.map((r) => {
        const attended = r.present + r.late;
        return (
          <StudentCard key={r.id} name={r.fullName}
            tone={r.flagged ? 'risk' : r.absent > 0 ? 'warn' : undefined}
            badge={r.flagged
              ? <Flag tone="risk">غاب <Num>{toArabicDigits(r.streak)}</Num> متتالية</Flag>
              : undefined}
            stats={<>
              <Stat label="حضر" big tone={attended === r.registered ? 'ok' : 'ink'}
                value={<OutOf n={attended} of={r.registered || halaqaDays} />} />
              {r.late > 0 && (
                <Stat label="متأخر" tone="warn" value={<Num>{toArabicDigits(r.late)}</Num>} />
              )}
              <Stat label="غاب" tone={r.absent > 0 ? 'risk' : 'ink'}
                value={<Num>{toArabicDigits(r.absent)}</Num>} />
              {r.unregistered > 0 && (
                /* صمت المعلم لا غياب الطالب — ويُقال كذلك. */
                <Stat label="لم تُسجَّل" value={<Num>{toArabicDigits(r.unregistered)}</Num>} />
              )}
            </>} />
        );
      })}
    </ul>
  );
}

/* ── كشف التسميع الناقص ─────────────────────────────────────────────────── */

export type IncompleteRow = {
  id: string; fullName: string; times: number;
  days: { day: string; assignmentNo: number | null; missing: string[] }[];
};

export function IncompleteView({ rows }: { rows: IncompleteRow[] }) {
  if (!rows.length) {
    return <Empty icon={FileText} title="لا تسميع ناقص"
      body="لم ينتقل أحد بدرسه دون تمام مراجعته في هذه المدة. وهذا هو المطلوب." />;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <StudentCard key={r.id} name={r.fullName}
          tone={r.times >= 3 ? 'risk' : 'warn'}
          badge={<Flag tone={r.times >= 3 ? 'risk' : 'warn'}>
            <Num>{toArabicDigits(r.times)}</Num>{' '}
            {r.times === 1 ? 'مرة' : r.times === 2 ? 'مرتين' : 'مرات'}
          </Flag>}>
          {/* الأيام نفسها، وما تُرك في كل يوم — وهو ما يُعالَج. */}
          <ul className="mt-3 space-y-1.5 border-t border-ink-150 pt-3">
            {r.days.map((d) => (
              <li key={d.day} className="flex flex-wrap items-baseline gap-x-2 text-xs2">
                <When iso={d.day} />
                {d.assignmentNo != null && (
                  <span className="text-ink-500">المقرّر <Num>{toArabicDigits(d.assignmentNo)}</Num></span>
                )}
                {d.missing.length > 0 && (
                  <span className="text-warn-700">تُرك: {d.missing.join(' · ')}</span>
                )}
              </li>
            ))}
          </ul>
        </StudentCard>
      ))}
    </ul>
  );
}

/* ── المستحقون للاختبار ─────────────────────────────────────────────────── */

export type DueRow = {
  id: string; fullName: string; trackAr: string;
  level: number | null; assignmentNo: number | null;
  badgeAr: string | null; dueSince: string | null; bookedOn: string | null;
};

export function DueView({ rows }: { rows: DueRow[] }) {
  if (!rows.length) {
    return <Empty icon={Award} title="لا مستحقّين"
      body="لم يبلغ أحد مقرّر الاختبار بعد. من يبلغه يقف عنده ويظهر هنا في لحظته." />;
  }
  /* من لم يُحجز له بعد أولًا — فهو ما يُرسَل إلى المشرف. */
  const sorted = [...rows].sort((a, b) =>
    Number(!!a.bookedOn) - Number(!!b.bookedOn)
    || (a.dueSince ?? '').localeCompare(b.dueSince ?? ''));

  return (
    <ul className="space-y-2.5">
      {sorted.map((r) => (
        <StudentCard key={r.id} name={r.fullName} sub={r.trackAr}
          tone={r.bookedOn ? 'ok' : 'warn'}
          badge={r.bookedOn
            ? <Flag tone="ok">محجوز</Flag>
            : <Flag tone="warn">بانتظار موعد</Flag>}
          stats={<>
            <Stat label="الوسام" value={<span className="text-base2">{r.badgeAr ?? '—'}</span>} />
            <Stat label="المستوى" value={r.level != null
              ? <Num>{toArabicDigits(r.level)}</Num> : <span className="text-ink-400">—</span>} />
            <Stat label="المقرّر" value={r.assignmentNo != null
              ? <Num>{toArabicDigits(r.assignmentNo)}</Num> : <span className="text-ink-400">—</span>} />
            <Stat label="استحقّ منذ" value={<When iso={r.dueSince} />} />
            {r.bookedOn && <Stat label="موعده" tone="brand" value={<When iso={r.bookedOn} />} />}
          </>} />
      ))}
    </ul>
  );
}

/* ── فرسان الأسبوع ──────────────────────────────────────────────────────── */

export type KnightRow = { id: string; fullName: string };

export function KnightsView({
  rows, considered, halaqaDays,
}: { rows: KnightRow[]; considered: number; halaqaDays: number }) {
  if (!rows.length) {
    return <Empty icon={ShieldCheck} title="لا فرسان هذا الأسبوع"
      body="الفارس من حضر في وقته بثوبه وسمّع الدرس والمراجعتين في كل يوم انعقدت فيه الحلقة. بعض الأسابيع لا أحد، وهذا وجه من وجوه الصدق." />;
  }
  return (
    <>
      <p className="mb-3 text-xs2 text-ink-600">
        أتمّوا <Num className="font-medium text-ink-800">{toArabicDigits(halaqaDays)}</Num>{' '}
        {halaqaDays === 1 ? 'يوم حلقة' : 'أيام حلقة'} كاملة —{' '}
        <Num className="font-medium text-ink-800">{toArabicDigits(rows.length)}</Num> من{' '}
        <Num>{toArabicDigits(considered)}</Num>. وهم سواء، فلا ترتيب بينهم.
      </p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id}
            className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
            <ShieldCheck size={20} className="shrink-0 text-brand-700" strokeWidth={1.9} />
            <span className="min-w-0 truncate text-base2 font-medium text-ink-900">{r.fullName}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── لوحة الشرف ─────────────────────────────────────────────────────────── */

export type HonourRow = { id: string; fullName: string; balance: number; place: number };

export function HonourView({ rows }: { rows: HonourRow[] }) {
  if (!rows.length) {
    return <Empty icon={Trophy} title="لا أرصدة بعد"
      body="تظهر لوحة الشرف حين تبدأ النقاط — وهي تُحسب من تسجيلك أنت." />;
  }
  const most = rows[0]?.balance || 1;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id}
          className={cx('rounded-2xl border bg-paper p-4 shadow-soft',
            r.place === 1 ? 'border-brand-300' : 'border-ink-150')}>
          <div className="flex items-center gap-3">
            {/* المرتبة من الخادم — فالمتساويان يحملان الرقم نفسه. */}
            <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-base2',
              r.place === 1 ? 'bg-brand-800 text-white' : 'bg-brand-50 text-brand-800')}>
              <Num>{toArabicDigits(r.place)}</Num>
            </span>
            <span className="min-w-0 flex-1 truncate text-base2 font-medium text-ink-900">
              {r.fullName}
            </span>
            <span className="shrink-0 font-display text-t2 tabular-nums text-brand-800">
              <Num>{toArabicDigits(r.balance)}</Num>
            </span>
          </div>
          {/* شريط يُقرأ بالعين قبل الرقم. */}
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-brand-700"
              style={{ width: `${Math.max(6, Math.round((r.balance / most) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
