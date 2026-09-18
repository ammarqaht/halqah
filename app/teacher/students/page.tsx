'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   مع-٤-أ طلابي.

   «صفّ لكل طالب: الاسم كاملًا، والمسار والمستوى، والمقرّر الحالي، وآخر تسميع،
   ورصيد النقاط. وعمود تنبيه صغير. وبحث بالاسم، وترتيب بأيّ عمود — ليعرف المعلم
   من أكثر طلابه تقدّمًا ومن تخلّف.»

   And NO halaqa column: «العمود الذي يتكرر بلا اختلاف لا يستحق مساحة. فلا عمود
   للحلقة في بوابة المعلم أصلًا، لأنها واحدة.»

   On a phone a table of seven columns is a table nobody reads, so the same rows
   become cards below `md` and a real table above it. Same data, same order, same
   sort — one screen with two shapes, not two screens.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown, Award, BookOpenCheck, CalendarClock, ChevronLeft, Clock, Search,
  UserX, Users,
} from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty } from '@/components/ui';
import { Num } from '@/components/Num';
import { COPY } from '@/content/teacher';
import { relativeDay } from '@/lib/dates';
import { foldArabic } from '@/lib/normalise';
import { cx } from '@/lib/cx';

type Row = {
  id: string;
  fullName: string;
  track: string | null;
  trackAr: string | null;
  level: number | null;
  assignmentNo: number | null;
  assignmentOf: number;
  awaitingExam: string | null;
  lastRecitedOn: string | null;
  balance: number | null;
  flags: {
    dueForExam: boolean;
    needsReview: boolean;
    booked: string | null;
    lateOnLevel: boolean;
    absence: number;
    absenceKind: 'STREAK' | 'WINDOW' | null;
  };
};

type Sort = 'name' | 'level' | 'assignment' | 'recited' | 'balance';

const SORTS: { code: Sort; label: string }[] = [
  { code: 'name',       label: 'الاسم' },
  { code: 'level',      label: 'المستوى' },
  { code: 'assignment', label: 'المقرّر' },
  { code: 'recited',    label: 'آخر تسميع' },
  { code: 'balance',    label: 'النقاط' },
];

export default function StudentsScreen() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  /* «إذا ضغطت عليها مرة أخرى يرتّب الطلاب تصاعديًا أو تنازليًا» — the same chip
     is the toggle. Each column starts in the direction that is USEFUL: the name
     from alif, the level from the most advanced, the longest silence first. A
     second tap turns it over. */
  const [desc, setDesc] = useState(false);
  const press = (code: Sort) => {
    if (code === sort) { setDesc((d) => !d); return; }
    setSort(code); setDesc(false);
  };

  useEffect(() => {
    fetch('/api/teacher/students')
      .then((r) => (r.ok ? r.json() : { students: [] }))
      .then((d) => setRows(d.students ?? []))
      .catch(() => setRows([]));
  }, []);

  const shown = useMemo(() => {
    const needle = foldArabic(q.trim());
    const list = (rows ?? []).filter(
      (r) => !needle || foldArabic(r.fullName).includes(needle));
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      name: (a, b) => a.fullName.localeCompare(b.fullName, 'ar'),
      /* The level counts DOWN — 60 is the start of the silver track and 1 its
         end — so «الأكثر تقدّمًا» is the SMALLEST number, and sorting ascending is
         sorting by progress. A boy with no level sinks rather than leading. */
      level: (a, b) => (a.level ?? 999) - (b.level ?? 999),
      assignment: (a, b) => (b.assignmentNo ?? -1) - (a.assignmentNo ?? -1),
      /* Longest silence first: that is who this column is for. */
      recited: (a, b) => String(a.lastRecitedOn ?? '').localeCompare(String(b.lastRecitedOn ?? '')),
      balance: (a, b) => (b.balance ?? -1) - (a.balance ?? -1),
    };
    const sorted = [...list].sort(by[sort]);
    return desc ? sorted.reverse() : sorted;
  }, [rows, q, sort, desc]);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="relative min-w-0 flex-1">
          <Search size={16}
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={COPY.searchStudents}
            className="h-11 w-full rounded-lg border border-ink-200 bg-paper pe-10 ps-3.5 text-base2 text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none" />
        </span>
        <span className="shrink-0 text-xs2 text-ink-500">
          <Num className="font-bold text-ink-900">{shown.length}</Num> طالبًا
        </span>
      </div>

      {/* The sort is chips on a phone, because a table header is not tappable at
          that width — and the same five keys above `md` are the column heads. */}
      <div className="no-bar -mx-5 flex gap-1.5 overflow-x-auto px-5 md:hidden">
        {SORTS.map((s) => (
          <button key={s.code} onClick={() => press(s.code)}
            aria-pressed={sort === s.code}
            className={cx('press flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-panel transition-colors',
              sort === s.code ? 'border-brand-700 bg-brand-100 font-medium text-brand-800'
                              : 'border-ink-200 bg-paper text-ink-600')}>
            {s.label}
            {sort === s.code && (
              <ArrowUpDown size={12} strokeWidth={2.2}
                className={cx('transition-transform', desc && 'rotate-180')} />
            )}
          </button>
        ))}
      </div>

      {rows === null ? (
        <ul className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <li key={i} className="skel h-[88px] rounded-2xl" />)}
        </ul>
      ) : shown.length === 0 ? (
        <Sheet>
          <Empty icon={Users} title={q ? 'لا نتائج' : 'لا طلاب'}
            body={q ? COPY.noStudents : COPY.noRoster}
            action={q ? <Btn onClick={() => setQ('')}>امسح البحث</Btn> : undefined} />
        </Sheet>
      ) : (
        <>
          {/* phone — cards */}
          <ul className="space-y-2 md:hidden">
            {shown.map((r) => (
              <li key={r.id}>
                <Link href={`/teacher/students/${r.id}`}
                  className="press block rounded-2xl border border-ink-150 bg-paper px-[18px] py-3.5 shadow-soft transition-colors hover:border-brand-200">
                  {/* The marks ride in the card's own row, at its left end —
                      «قرص يستحق اختبارًا تكون في الجهة اليسرى ولا يكون لها سطر
                      لوحدها» (client, 18 Sep 2026). A line of its own under
                      three lines of text made the card taller for a chip that
                      most cards do not have at all. */}
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base2 font-medium text-ink-900">{r.fullName}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs2 text-ink-500">
                        {r.trackAr && <span>{r.trackAr}</span>}
                        {r.level != null && <span>· المستوى <Num>{r.level}</Num></span>}
                        {r.assignmentNo != null && (
                          <span className="text-brand-800">
                            · المقرّر <Num>{r.assignmentNo}</Num>
                            {r.assignmentOf > 0 && <> من <Num>{r.assignmentOf}</Num></>}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-micro text-ink-500">
                        <span>آخر تسميع: {r.lastRecitedOn ? relativeDay(r.lastRecitedOn) : 'لا شيء'}</span>
                        {r.balance != null && (
                          <span>· <Num className="font-bold text-ink-800">{r.balance}</Num> نقطة</span>
                        )}
                      </p>
                    </div>
                    <Flags flags={r.flags} stacked />
                    <ChevronLeft size={16} className="mt-1 shrink-0 text-ink-300" strokeWidth={2} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* desktop — a real table, at work density */}
          <div className="hidden overflow-hidden rounded-2xl border border-ink-150 bg-paper shadow-soft md:block">
            <table className="w-full text-panel">
              <thead className="bg-page text-2xs uppercase tracking-[.05em] text-ink-500">
                <tr>
                  {SORTS.map((s) => (
                    <th key={s.code} className="px-3 py-2.5 text-start font-medium">
                      <button onClick={() => press(s.code)} aria-pressed={sort === s.code}
                        className={cx('inline-flex items-center gap-1 transition-colors hover:text-ink-900',
                          sort === s.code && 'text-brand-800')}>
                        {s.label}
                        {sort === s.code && (
                          <ArrowUpDown size={11} strokeWidth={2.2}
                            className={cx('transition-transform', desc && 'rotate-180')} />
                        )}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-start font-medium">تنبيه</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t border-ink-150 transition-colors hover:bg-brand-50">
                    <td className="px-3 py-3">
                      <Link href={`/teacher/students/${r.id}`}
                        className="font-medium text-ink-900 hover:text-brand-800">
                        {r.fullName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-600">
                      {r.trackAr ?? '—'}
                      {r.level != null && <> · <Num>{r.level}</Num></>}
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {r.assignmentNo != null
                        ? <><Num>{r.assignmentNo}</Num>{r.assignmentOf > 0 && <span className="text-ink-400"> / <Num>{r.assignmentOf}</Num></span>}</>
                        : <span className="text-ink-400">لم يُحدَّد</span>}
                    </td>
                    <td className="px-3 py-3 text-ink-600">
                      {r.lastRecitedOn ? relativeDay(r.lastRecitedOn) : '—'}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-ink-900">
                      {r.balance != null ? <Num>{r.balance}</Num> : '—'}
                    </td>
                    <td className="px-3 py-3"><Flags flags={r.flags} inline /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** The alert column — four possible marks, each with a shape as well as a
    colour, and nothing at all when there is nothing to say. */
function Flags({ flags, inline, stacked }: {
  flags: Row['flags'];
  /** In a table cell, where «—» stands for nothing rather than nothing at all. */
  inline?: boolean;
  /** At the left end of a card's own row, one under another. */
  stacked?: boolean;
}) {
  const chips: { icon: typeof Award; tone: string; label: string }[] = [];
  if (flags.dueForExam) {
    chips.push({ icon: Award, tone: 'bg-warn-100 text-warn-700', label: 'يستحق الاختبار' });
  }
  /* «وتحط قرص في صفحة طلابي أنه يحتاج مراجعة» (client, 18 Sep 2026) — right
     after «يستحق الاختبار», because the two are read together: he has reached
     his exam مقرّر, and his teacher does not think he is ready for it. */
  if (flags.needsReview) {
    chips.push({ icon: BookOpenCheck, tone: 'bg-risk-100 text-risk-700', label: 'يحتاج مراجعة' });
  }
  if (flags.booked) {
    chips.push({ icon: CalendarClock, tone: 'bg-info-100 text-info-700', label: 'اختبار محجوز' });
  }
  if (flags.lateOnLevel) {
    chips.push({ icon: Clock, tone: 'bg-ink-100 text-ink-700', label: 'تأخّر على مستواه' });
  }
  if (flags.absence) {
    chips.push({
      icon: UserX, tone: 'bg-risk-100 text-risk-700',
      label: flags.absenceKind === 'STREAK'
        ? `غاب ${flags.absence} متتالية` : `غاب ${flags.absence} هذا الشهر`,
    });
  }
  if (!chips.length) return inline ? <span className="text-ink-300">—</span> : null;

  return (
    <span className={cx('flex gap-1',
      stacked ? 'max-w-[7.5rem] shrink-0 flex-col items-end' : 'flex-wrap',
      !inline && !stacked && 'mt-2')}>
      {chips.map((c) => {
        const I = c.icon;
        return (
          <span key={c.label}
            className={cx('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-medium',
              stacked && 'whitespace-nowrap', c.tone)}>
            <I size={11} strokeWidth={2.2} />{c.label}
          </span>
        );
      })}
    </span>
  );
}
