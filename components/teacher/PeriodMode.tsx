'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   وضع «فترة لطالب» — مع-٣-و، الوضع الثاني.

   «يختار طالبًا وفترة من تاريخ إلى تاريخ، فيسجّل حضوره وتسميعه فيها كلها من شاشة
   واحدة.»

   Its axis is the other way round from the day screen: one boy down a column of
   days rather than one day down a column of boys. That is why it is a separate
   component and not a filter — the same cards, stacked against a different
   spine, and the thing a teacher reaches for when he has a fortnight to catch up
   or a week to correct.

   It is also «المكان الوحيد للتعديل» that ملف الطالب points at, so the file can
   stay read-only without leaving the teacher anywhere to fix a wrong day.

   «ولا يعرض فيها يومًا لا حلقة فيه» — the days come from the server already
   filtered to the halaqa's own weekdays, so a Friday in the middle of the range
   is absent rather than shown as an unregistered absence.
   ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarRange, ChevronLeft, Loader2, Search } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty } from '@/components/ui';
import { DateRangeField } from '@/components/DateField';
import { HijriText, Num } from '@/components/Num';
import {
  StudentCard, draftOf, type Card, type DailyTable, type Draft, type SaveState,
} from '@/components/teacher/StudentCard';
import { COPY } from '@/content/teacher';
import { cx } from '@/lib/cx';

type Row = { day: string; heading: { weekday: string; hijri: string; gregorian: string }; card: Card };

type Payload = {
  student: { id: string; fullName: string };
  from: string; to: string;
  days: Row[];
  counts: { days: number; saved: number; absent: number; recited: number; points: number };
  /** The halaqa's point table — what each card's «نقاط يومه» box counts by. */
  daily: DailyTable;
};

/* «حطّ الطالب في بطاقات ومعهم المستوى والمقرّر فقط» (client, 18 Sep 2026) — so
   the picker carries the two facts that tell a teacher he has the right boy,
   and nothing else. A row of bare names makes him open one to find out. */
type Pick = {
  id: string; fullName: string;
  level: number | null; assignmentNo: number | null; assignmentOf: number;
};

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function PeriodMode({ onSaved, preselect }: {
  onSaved: () => void;
  /** A student id from the URL — the file's «صحّح أيامه» button lands here with
      the boy already chosen, so nobody picks him out of a list twice. */
  preselect?: string | null;
}) {
  const [roster, setRoster] = useState<Pick[] | null>(null);
  const [q, setQ] = useState('');
  const [student, setStudent] = useState<Pick | null>(null);
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 13 * 86_400_000)));
  const [to, setTo] = useState(() => iso(new Date()));

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/teacher/students')
      .then((r) => (r.ok ? r.json() : { students: [] }))
      .then((d) => {
        const list: Pick[] = (d.students ?? []).map((s: Pick) => ({
          id: s.id, fullName: s.fullName, level: s.level ?? null,
          assignmentNo: s.assignmentNo ?? null, assignmentOf: s.assignmentOf ?? 0,
        }));
        setRoster(list);
        if (preselect) {
          const found = list.find((s) => s.id === preselect);
          if (found) setStudent(found);
        }
      })
      .catch(() => setRoster([]));
  }, [preselect]);

  const load = useCallback(async () => {
    if (!student) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch(
        `/api/teacher/period?student=${student.id}&from=${from}&to=${to}`);
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'تعذّر تحميل الفترة.'); setData(null); return; }
      setData(d);
      /* Keyed by DAY here, not by student — the column is days. */
      setDrafts(Object.fromEntries(d.days.map((r: Row) => [r.day, draftOf(r.card)])));
      setStates(Object.fromEntries(d.days.map((r: Row) => [r.day, 'CLEAN' as SaveState])));
      setErrors({});
    } catch {
      setErr('تعذّر الاتصال. أعد المحاولة.');
    } finally {
      setLoading(false);
    }
  }, [student, from, to]);

  useEffect(() => { if (student) void load(); }, [student, load]);

  const save = useCallback(async (row: Row) => {
    const d = drafts[row.day];
    /* A CLEARED card has no status, and that is a save — the deletion. This read
       `!d?.status` and returned, so «امسح تسجيله» did nothing at all on this
       screen while working on التسجيل beside it. What has nothing to write is a
       card that was never saved and has nothing chosen. */
    if (!d || !student) return;
    if (!d.status && !row.card.savedAt) return;
    setStates((s) => ({ ...s, [row.day]: 'SAVING' }));
    setErrors((e) => ({ ...e, [row.day]: '' }));
    try {
      const res = await fetch('/api/teacher/day', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: row.day,
          studentId: student.id,
          status: d.status,
          thobe: d.thobe,
          note: d.note,
          lines: Object.entries(d.lines).map(([kind, v]) => ({ kind, ...v })),
          talqeenSurah: d.talqeenSurah ?? null,
          talqeenAyah: d.talqeenAyah ? Number(d.talqeenAyah) : null,
        }),
      });
      if (res.ok) {
        setStates((s) => ({ ...s, [row.day]: 'SAVED' }));
        /* Each saved day may move his مقرّر, and the days BELOW this one show
           the passages that pointer names — so the column is re-read rather
           than patched. «الانتقال يقع بترتيب التسجيل», and this is the screen
           where that is most visible. */
        await load();
        onSaved();
        return;
      }
      const dd = await res.json().catch(() => ({}));
      setErrors((e) => ({ ...e, [row.day]: dd.error ?? 'تعذّر الحفظ.' }));
      setStates((s) => ({ ...s, [row.day]: 'ERROR' }));
    } catch {
      setErrors((e) => ({ ...e, [row.day]: 'لا اتصال — أعد المحاولة بعد عودة الشبكة.' }));
      setStates((s) => ({ ...s, [row.day]: 'ERROR' }));
    }
  }, [drafts, student, load, onSaved]);

  const matches = (roster ?? []).filter(
    (s) => !q.trim() || s.fullName.includes(q.trim()));

  return (
    <div className="space-y-3.5">
      {/* ── who, and over what ──────────────────────────────────────────────
          Before a boy is chosen this is a SEARCH and a list of cards on the page
          itself — «بطاقات أسماء الطلاب في البحث لا يكونون داخل جدول» (client,
          18 Sep 2026). A box around them gave the list its own scroll inside the
          page's scroll, which is two rails for one column of names. Once a boy
          IS chosen the box comes back, because then it holds one thing: who,
          and over what period. */}
      <div className={cx(!student ? 'space-y-2.5'
        : 'rounded-2xl border border-ink-150 bg-paper p-[18px] shadow-soft')}>
        {!student ? (
          <>
            {/* البحث في الأعلى — the field the teacher reaches for first sits
                where his thumb lands, above the names rather than under a
                label that repeats what the screen already said. */}
            <span className="relative block">
              <Search size={16}
                className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={COPY.searchStudents} aria-label="ابحث عن الطالب"
                className="h-11 w-full rounded-xl border border-ink-200 bg-paper pe-10 ps-3.5 text-base2 text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none" />
            </span>

            {roster === null ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <div key={i} className="skel h-[62px] rounded-2xl" />)}
              </div>
            ) : matches.length === 0 ? (
              <Sheet><Empty icon={CalendarRange} title="لا نتائج" body={COPY.noStudents} /></Sheet>
            ) : (
              <ul className="space-y-2">
                {matches.map((s, i) => (
                  <li key={s.id} className="rise"
                    style={{ animationDelay: `${Math.min(i, 9) * 45}ms` }}>
                    <button type="button" onClick={() => setStudent(s)}
                      className="press flex w-full items-center gap-3 rounded-2xl border border-ink-150 bg-paper px-[18px] py-3 text-start shadow-soft transition-colors hover:border-brand-200 hover:bg-brand-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base2 font-medium text-ink-900">
                          {s.fullName}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-micro text-ink-500">
                          {s.level != null && <span>المستوى <Num>{s.level}</Num></span>}
                          {s.assignmentNo != null && (
                            <span className="text-brand-800">
                              {s.level != null && '· '}المقرّر <Num>{s.assignmentNo}</Num>
                              {s.assignmentOf > 0 && <> من <Num>{s.assignmentOf}</Num></>}
                            </span>
                          )}
                          {s.level == null && s.assignmentNo == null && <span>لم يُحدَّد مقرّره</span>}
                        </span>
                      </span>
                      <ChevronLeft size={16} className="shrink-0 text-ink-300" strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-micro text-ink-500">الطالب</p>
                <p className="mt-px truncate text-lg2 font-medium text-ink-900">
                  {student.fullName}
                </p>
              </div>
              <button type="button"
                onClick={() => { setStudent(null); setData(null); }}
                className="press shrink-0 rounded-lg border border-ink-200 px-2.5 py-1.5 text-panel text-ink-600">
                غيّره
              </button>
            </div>

            {/* The site's own calendar, not the operating system's — and ONE of
                them for the whole period, so an end before its own start cannot
                be expressed at all. */}
            <div className="mt-3.5 flex flex-wrap items-end gap-2.5">
              <div className="min-w-[13rem] flex-1">
                <span className="mb-1 flex items-center gap-2 text-micro text-ink-500">
                  الفترة
                  {loading && <Loader2 size={12} className="animate-spin text-brand-700" />}
                </span>
                {/* No «اعرض» button: the second tap on the calendar IS the
                    request — «مباشرة من تحديد يوم النهاية تتحدث البيانات»
                    (client, 18 Sep 2026). It was always redundant, since the
                    column re-reads whenever the period changes; it just made the
                    reader press twice for one decision. */}
                <DateRangeField from={from} to={to} max={iso(new Date())}
                  label="فترة الطالب"
                  onChange={(a, b) => { setFrom(a); setTo(b); }} />
              </div>
            </div>

            {data && (
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs2 text-ink-600">
                <span><Num className="font-bold text-ink-900">{data.counts.days}</Num> يوم حلقة</span>
                <span>· حُفظ <Num className="font-bold text-ink-900">{data.counts.saved}</Num></span>
                <span>· غائب <Num className="font-bold text-risk-700">{data.counts.absent}</Num></span>
                <span>· سمّع <Num className="font-bold text-brand-800">{data.counts.recited}</Num></span>
              </p>
            )}
          </>
        )}
      </div>

      {/* ── the column of days ────────────────────────────────────────────── */}
      {!student ? null
        : err ? (
          <Sheet>
            <Empty icon={AlertTriangle} title="تعذّر التحميل" body={err}
              action={<Btn variant="primary" onClick={() => void load()}>أعد المحاولة</Btn>} />
          </Sheet>
        ) : loading && !data ? (
          <ul className="space-y-2.5">
            {[0, 1, 2].map((i) => <li key={i} className="skel h-[190px] rounded-2xl" />)}
          </ul>
        ) : !data || data.days.length === 0 ? (
          <Sheet>
            <Empty icon={CalendarRange} title="لا أيام حلقة في هذه الفترة"
              body="لا يوم من أيام حلقتك في المدة التي اخترتها. وسّع الفترة أو راجع أيام حلقتك عند المشرف." />
          </Sheet>
        ) : (
          <ul className="space-y-2.5">
            {data.days.map((r, i) => (
              <li key={r.day} className="rise"
                style={{ animationDelay: `${Math.min(i, 7) * 55}ms` }}>
                {/* The day is the spine here, so it is named above the card
                    rather than left to the bar at the top of the screen. */}
                <p className={cx('mb-1 flex items-baseline gap-2 px-1 text-xs2',
                  r.card.status === null ? 'text-warn-700' : 'text-ink-500')}>
                  <span className="font-medium">{r.heading.weekday}</span>
                  <HijriText day={r.day} />
                  <span className="text-ink-400">· <Num>{r.heading.gregorian}</Num></span>
                  {r.card.status === null && <span className="ms-auto">لم يُسجَّل</span>}
                </p>
                <ul>
                  <StudentCard card={r.card} daily={data.daily} nameless
                    draft={drafts[r.day] ?? draftOf(r.card)}
                    state={states[r.day] ?? 'CLEAN'}
                    error={errors[r.day] || undefined}
                    onChange={(next) => {
                      setDrafts((d) => ({ ...d, [r.day]: next }));
                      setStates((s) => ({ ...s, [r.day]: 'DIRTY' }));
                    }}
                    onSave={() => void save(r)} />
                </ul>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
