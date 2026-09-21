'use client';
/* كشف الحضور والتسميع — ما سجّله المعلمون في بوابتهم.
 *
 * Seven teachers record an afternoon each; the supervisor responsible for all
 * seven could see none of it. Everything on his side was built on the imported
 * roster and on what he typed himself, and the register stayed inside the
 * portal that wrote it.
 *
 * THE FIRST VERSION OF THIS SCREEN GAVE EVERY HALAQA A FULL CARD with five
 * large day boxes under it. Six of the seven halaqat had recorded nothing, so
 * six cards of mostly empty dashed boxes pushed the ONE that had work in it off
 * the bottom of the screen — every halaqa shouting at the same volume, and the
 * loudest thing on the page was the silence.
 *
 * So: a row each, dense enough that all seven fit at once, with the week as a
 * tight bar. What needs the supervisor rises to the top — a halaqa with
 * absences before one that is merely quiet — and the one he opens expands in
 * place. The register is a thing to scan, not to read.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Check, X, Clock, Minus, ChevronRight, ChevronLeft, ChevronDown,
  CalendarX, AlertTriangle,
} from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Num } from '@/components/Num';
import { Empty } from '@/components/ui';
import { DayDetail, type StripDay } from '@/components/WeekStrip';
import { WEEKDAY_AR, dayLabel, weekLabel } from '@/lib/week';
import { halaqaLabel, shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

type Row = {
  id: string; fullName: string; track: string | null; level: number | null;
  cells: StripDay[]; present: number; late: number; absent: number;
  recitedDays: number; errors: number; allAbsent: boolean;
};
type DayRow = {
  day: string; future: boolean; saved: number; roster: number;
  present: number; late: number; absent: number; recited: number;
  state: 'NONE' | 'PARTIAL' | 'FULL';
};
type Halaqa = {
  id: string; name: string; teacher: string; timeSlot: string; roster: number;
  days: DayRow[]; students: Row[];
  present: number; late: number; absent: number; recited: number;
  unsaved: number; absentees: string[];
};
type Payload = {
  today: string; week: string; prevWeek: string; nextWeek: string | null;
  isThisWeek: boolean; days: string[]; halaqat: Halaqa[]; ever: number;
};

const ICON: Record<string, typeof Check> = { PRESENT: Check, LATE: Clock, ABSENT: X };

export function Register({ halaqaId }: { halaqaId?: string | null }) {
  const [d, setD] = useState<Payload | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [cell, setCell] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(true);
    const q = new URLSearchParams();
    if (week) q.set('week', week);
    if (halaqaId) q.set('halaqa', halaqaId);
    fetch(`/api/admin/register?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) { setD(j); setCell(null); } })
      .catch(() => { /* the register is not worth a red box */ })
      .finally(() => setBusy(false));
  }, [week, halaqaId]);

  /* One halaqa asked for: open it, there is nothing to choose between. */
  useEffect(() => { if (halaqaId) setOpen(halaqaId); }, [halaqaId]);

  /* What needs him first.
     The first cut of this ranked «لم يُسجَّل» above everything, reasoning that
     an unrecorded day wants chasing. It put six halaqat that had recorded
     NOTHING above the one that had recorded a full afternoon — which is the
     complaint this screen was rebuilt to answer, reproduced by the fix.
     A halaqa that is live outranks one that is silent; what is wrong inside a
     live one outranks the rest; and a halaqa nobody has touched sits at the
     bottom, where its own row already says so. */
  const ordered = useMemo(() => {
    if (!d) return [];
    const weight = (h: Halaqa) => {
      const live = h.present + h.late + h.absent > 0;
      if (!live) return 0;                                   // لم يبدأ معلمها
      return 2                                               // حلقة عاملة
        + (h.absent > 0 ? 2 : 0)                             // وفيها غياب
        + (h.absentees.length ? 4 : 0)                       // وفيها من غاب الأسبوع كلّه
        + (h.unsaved > 0 ? 1 : 0);                           // وأيام ناقصة
    };
    return [...d.halaqat].sort((a, b) =>
      weight(b) - weight(a) || b.present - a.present || a.teacher.localeCompare(b.teacher, 'ar'));
  }, [d]);

  if (!d) return <div className="skel h-[320px] rounded-2xl" />;

  if (d.ever === 0) {
    return (
      <Sheet className="rise">
        <Empty icon={CalendarX} title="لا تسجيل بعد"
          body="لم يسجّل أيّ معلم حضورًا أو تسميعًا في بوابته حتى الآن. ما يسجّلونه يظهر هنا في لحظته." />
      </Sheet>
    );
  }

  /* حصيلة الأسبوع كلّه — سطر واحد فوق الكشف يجيب «كيف كان الأسبوع؟». */
  const all = d.halaqat.reduce((a, h) => ({
    present: a.present + h.present, late: a.late + h.late,
    absent: a.absent + h.absent, recited: a.recited + h.recited,
    unsaved: a.unsaved + h.unsaved, quiet: a.quiet + (h.present + h.late + h.absent === 0 ? 1 : 0),
  }), { present: 0, late: 0, absent: 0, recited: 0, unsaved: 0, quiet: 0 });

  return (
    <>
      {/* ── الأسبوع وحصيلته ────────────────────────────────────────────────── */}
      <Sheet className="rise mb-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setWeek(d.prevWeek)} disabled={busy}
            aria-label="الأسبوع السابق"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-page disabled:opacity-40">
            <ChevronRight size={17} />
          </button>

          <div className={cx('min-w-0 flex-1 text-center transition', busy && 'opacity-40')}>
            <p className="text-base2 text-ink-900">
              {d.isThisWeek ? 'هذا الأسبوع' : weekLabel(d.week)}
            </p>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-cap">
              <span className="text-brand-700"><Num>{all.present + all.late}</Num> حضور</span>
              <span className="text-risk-700"><Num>{all.absent}</Num> غياب</span>
              <span className="text-ink-600"><Num>{all.recited}</Num> تسميعًا</span>
              {all.quiet > 0 && (
                <span className="text-ink-500">
                  <Num>{all.quiet}</Num> {all.quiet === 1 ? 'حلقة بلا تسجيل' : 'حلقات بلا تسجيل'}
                </span>
              )}
            </p>
          </div>

          <button onClick={() => d.nextWeek && setWeek(d.nextWeek)} disabled={busy || !d.nextWeek}
            aria-label="الأسبوع التالي"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-page disabled:opacity-30">
            <ChevronLeft size={17} />
          </button>
        </div>
      </Sheet>

      {/* ── صفّ لكل حلقة ───────────────────────────────────────────────────── */}
      <Sheet className="rise" pad={false}>
        <ul>
          {ordered.map((h, i) => {
            const isOpen = open === h.id;
            const quiet = h.present + h.late + h.absent === 0;
            return (
              <li key={h.id} className={cx(i > 0 && 'border-t border-ink-150')}>
                <button onClick={() => setOpen(isOpen ? null : h.id)}
                  className={cx('flex w-full items-center gap-4 px-5 py-3.5 text-start transition hover:bg-page/60',
                    isOpen && 'bg-page/40')}>
                  {/* الاسم وحصيلته */}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-base2 text-ink-900">
                      {halaqaLabel(shortName(h.teacher))}
                      {h.absentees.length > 0 && (
                        <AlertTriangle size={13} className="shrink-0 text-risk-700" />
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-cap text-ink-500">
                      <span><Num>{h.roster}</Num> طالبًا</span>
                      {quiet ? (
                        <span className="text-ink-400">لم يُسجَّل هذا الأسبوع</span>
                      ) : (
                        <>
                          <span className="text-brand-700"><Num>{h.present + h.late}</Num> حضور</span>
                          {h.absent > 0 && (
                            <span className="text-risk-700"><Num>{h.absent}</Num> غياب</span>
                          )}
                          <span><Num>{h.recited}</Num> تسميعًا</span>
                          {h.unsaved > 0 && (
                            <span className="text-warn-700">
                              <Num>{h.unsaved}</Num> {h.unsaved === 1 ? 'يوم ناقص' : 'أيام ناقصة'}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>

                  {/* شريط الأيام الخمسة — مضغوط، يُقرأ بلمحة */}
                  <div className="hidden shrink-0 gap-1 sm:flex" aria-hidden>
                    {h.days.map((x) => (
                      <span key={x.day}
                        title={`${dayLabel(x.day)} — ${x.state === 'NONE' ? 'لم يُسجَّل' : `${x.saved} من ${x.roster}`}`}
                        className={cx('grid h-8 w-8 place-items-center rounded-md border text-micro tabular-nums',
                          x.state === 'NONE' ? 'border-dashed border-ink-200 text-ink-300'
                            : x.state === 'PARTIAL' ? 'border-warn-200 bg-warn-100/50 text-warn-700'
                            : 'border-brand-200 bg-brand-50 text-brand-700',
                          x.future && 'opacity-35',
                          x.day === d.today && 'ring-2 ring-ink-300 ring-offset-1')}>
                        {x.state === 'NONE' ? '·' : x.present + x.late}
                      </span>
                    ))}
                  </div>

                  <ChevronDown size={16}
                    className={cx('shrink-0 text-ink-400 transition', isOpen && 'rotate-180')} />
                </button>

                {isOpen && <HalaqaDetail h={h} today={d.today} cell={cell} setCell={setCell} />}
              </li>
            );
          })}
        </ul>
      </Sheet>

      <p className="mt-3.5 text-cap text-ink-500">
        ما يسجّله المعلم في بوابته يظهر هنا في لحظته. واليوم الذي لم يُسجَّل يظهر فارغًا —
        وهو ليس غيابًا: قد لا تكون الحلقة انعقدت، وقد لا يكون المعلم حفظ بعد.
      </p>
    </>
  );
}

/** طلاب الحلقة — يظهرون حين تُفتح، ومن غاب أولًا. */
function HalaqaDetail({
  h, today, cell, setCell,
}: {
  h: Halaqa; today: string;
  cell: string | null; setCell: (v: string | null) => void;
}) {
  /* من يحتاج نظرًا يتصدّر: الغائب كلّ الأسبوع، ثم من غاب، ثم البقية بأسمائهم. */
  const students = useMemo(() => [...h.students].sort((a, b) =>
    Number(b.allAbsent) - Number(a.allAbsent) || b.absent - a.absent
    || a.fullName.localeCompare(b.fullName, 'ar')), [h.students]);

  const openDay = cell?.startsWith(`${h.id}|`) ? cell.split('|') : null;
  const shown = openDay
    ? students.find((s) => s.id === openDay[1])?.cells.find((c) => c.day === openDay[2]) ?? null
    : null;

  return (
    <div className="fade border-t border-ink-150 bg-page/30 px-5 py-4">
      {h.absentees.length > 0 && (
        <p className="mb-3 rounded-lg border border-risk-200 bg-risk-100/50 px-3.5 py-2 text-panel text-risk-700">
          غاب الأسبوع كلّه: {h.absentees.join('، ')}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-body">
          <thead>
            <tr className="text-cap text-ink-500">
              <th className="pb-2 pe-3 text-start font-medium">الطالب</th>
              {WEEKDAY_AR.map((w) => (
                <th key={w} className="px-1 pb-2 text-center font-medium">{w}</th>
              ))}
              <th className="ps-3 pb-2 text-center font-medium">سمّع</th>
              <th className="ps-2 pb-2 text-center font-medium">أخطاء</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id} className="border-t border-ink-150">
                <td className="py-1.5 pe-3">
                  <span className={cx('text-ink-800', st.allAbsent && 'text-risk-700')}>
                    {st.fullName}
                  </span>
                </td>
                {st.cells.map((c) => {
                  const I = c.status ? ICON[c.status] : Minus;
                  const key = `${h.id}|${st.id}|${c.day}`;
                  const on = cell === key;
                  return (
                    <td key={c.day} className="px-1 py-1.5 text-center">
                      <button onClick={() => setCell(on ? null : key)} disabled={!c.status}
                        aria-label={`${st.fullName} — ${dayLabel(c.day)} — ${c.statusAr ?? 'لم يُسجَّل'}`}
                        className={cx('mx-auto grid h-7 w-7 place-items-center rounded-md border transition',
                          c.status === 'PRESENT' ? 'border-brand-200 bg-brand-50 text-brand-700'
                            : c.status === 'LATE' ? 'border-warn-200 bg-warn-100/60 text-warn-700'
                            : c.status === 'ABSENT' ? 'border-risk-200 bg-risk-100/60 text-risk-700'
                            : 'border-dashed border-ink-200 text-ink-300',
                          c.future && 'opacity-35',
                          c.status && 'hover:shadow-soft',
                          on && 'ring-2 ring-ink-400')}>
                        <I size={13} />
                      </button>
                    </td>
                  );
                })}
                <td className="ps-3 py-1.5 text-center tabular-nums text-ink-700">
                  <Num>{st.recitedDays}</Num>
                </td>
                <td className="ps-2 py-1.5 text-center tabular-nums text-ink-600">
                  {st.errors > 0 ? <Num>{st.errors}</Num> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* التفصيل تحت الجدول لا فوق الخانة: بطاقة عائمة فوق جدول يمرّ أفقيًّا
          تلاحق عمودًا تحرّك من تحتها. */}
      {shown && <DayDetail d={shown} />}
    </div>
  );
}
