'use client';
/* كشف الحضور والتسميع — ما سجّله المعلمون في بوابتهم.
 *
 * Seven teachers record an afternoon each; the supervisor responsible for all
 * seven could see none of it. Everything on his side was built on the imported
 * roster and on what he typed himself, and the register — who was present, who
 * recited — stayed inside the portal that wrote it.
 *
 * A week at a time, الأحد إلى الخميس, because that is the halaqa's week; a
 * halaqa at a time, because that is the unit he thinks in. Open a halaqa and
 * every boy's five afternoons are under it.
 *
 * The one thing this screen refuses to do is treat silence as absence. A day
 * with nothing saved is «لم يُسجَّل» — the teacher may not have saved yet, and
 * the halaqa may not have met. It is said plainly, and counted separately. */
import { useEffect, useState } from 'react';
import {
  Check, X, Clock, Minus, ChevronRight, ChevronLeft, ChevronDown,
  Users, CalendarX, Shirt,
} from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Num } from '@/components/Num';
import { Empty } from '@/components/ui';
import { WEEKDAY_AR, dayLabel, weekLabel } from '@/lib/week';
import { halaqaLabel, shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

type Line = { kind: string; kindAr: string; recited: boolean; errors: number; note: string | null };
type Cell = {
  day: string; status: string | null; statusAr?: string; future: boolean;
  thobe?: boolean; assignmentNo?: number | null; incomplete?: boolean;
  note?: string | null; savedBy?: string | null; savedByRole?: string;
  lines?: Line[]; recited?: number; errors?: number;
};
type Row = {
  id: string; fullName: string; track: string | null; level: number | null;
  cells: Cell[]; present: number; late: number; absent: number;
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

const TONE: Record<string, string> = {
  PRESENT: 'border-brand-200 bg-brand-50 text-brand-700',
  LATE: 'border-warn-200 bg-warn-100/60 text-warn-700',
  ABSENT: 'border-risk-200 bg-risk-100/60 text-risk-700',
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

  /* One halaqa asked for: open it, since there is nothing to choose between. */
  useEffect(() => { if (halaqaId) setOpen(halaqaId); }, [halaqaId]);

  if (!d) return <div className="skel h-[260px] rounded-2xl" />;

  if (d.ever === 0) {
    return (
      <Sheet className="rise">
        <Empty icon={CalendarX} title="لا تسجيل بعد"
          body="لم يسجّل أيّ معلم حضورًا أو تسميعًا في بوابته حتى الآن. ما يسجّلونه يظهر هنا في لحظته." />
      </Sheet>
    );
  }

  return (
    <>
      {/* ── الأسبوع ────────────────────────────────────────────────────────── */}
      <Sheet className="rise mb-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setWeek(d.prevWeek)} disabled={busy}
            aria-label="الأسبوع السابق"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-page disabled:opacity-40">
            <ChevronRight size={17} />
          </button>

          <div className={cx('text-center transition', busy && 'opacity-40')}>
            <p className="text-base2 text-ink-900">
              {d.isThisWeek ? 'هذا الأسبوع' : weekLabel(d.week)}
            </p>
            <p className="text-cap text-ink-500">الأحد إلى الخميس</p>
          </div>

          <button onClick={() => d.nextWeek && setWeek(d.nextWeek)} disabled={busy || !d.nextWeek}
            aria-label="الأسبوع التالي"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-page disabled:opacity-30">
            <ChevronLeft size={17} />
          </button>
        </div>
      </Sheet>

      {/* ── حلقة حلقة ──────────────────────────────────────────────────────── */}
      <div className="space-y-3.5">
        {d.halaqat.map((h) => {
          const isOpen = open === h.id;
          return (
            <Sheet key={h.id} className="rise" pad={false}>
              {/* رأس الحلقة — وحصيلة أسبوعها */}
              <button onClick={() => setOpen(isOpen ? null : h.id)}
                className="flex w-full items-start gap-3 px-6 py-4 text-start transition hover:bg-page/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base2 font-medium text-ink-900">
                    {halaqaLabel(shortName(h.teacher))}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-cap text-ink-500">
                    <span className="flex items-center gap-1">
                      <Users size={12} /><Num>{h.roster}</Num> طالبًا
                    </span>
                    <span className="text-brand-700"><Num>{h.present + h.late}</Num> حضور</span>
                    <span className="text-risk-700"><Num>{h.absent}</Num> غياب</span>
                    <span><Num>{h.recited}</Num> تسميعًا</span>
                    {h.unsaved > 0 && (
                      <span className="text-warn-700">
                        <Num>{h.unsaved}</Num> {h.unsaved === 1 ? 'يوم لم يُسجَّل' : 'أيام لم تُسجَّل'}
                      </span>
                    )}
                  </p>
                </div>
                <ChevronDown size={16}
                  className={cx('mt-1 shrink-0 text-ink-400 transition', isOpen && 'rotate-180')} />
              </button>

              {/* شريط الأيام الخمسة — حال كل يوم في الحلقة */}
              <div className="grid grid-cols-5 gap-1.5 px-6 pb-4">
                {h.days.map((x, i) => (
                  <div key={x.day}
                    title={`${WEEKDAY_AR[i]} ${dayLabel(x.day)} — ${x.state === 'NONE' ? 'لم يُسجَّل' : `${x.saved} من ${x.roster}`}`}
                    className={cx('rounded-lg border px-1.5 py-2 text-center',
                      x.state === 'NONE' ? 'border-dashed border-ink-200 text-ink-400'
                        : x.state === 'PARTIAL' ? 'border-warn-200 bg-warn-100/40 text-warn-700'
                        : 'border-brand-200 bg-brand-50 text-brand-700',
                      x.future && 'opacity-45',
                      x.day === d.today && 'ring-2 ring-ink-400 ring-offset-1')}>
                    <p className="text-micro opacity-80">{WEEKDAY_AR[i]}</p>
                    <p className="mt-0.5 text-panel font-medium tabular-nums">
                      {x.state === 'NONE' ? '—' : <><Num>{x.present + x.late}</Num>/<Num>{x.roster}</Num></>}
                    </p>
                    {x.absent > 0 && (
                      <p className="text-micro text-risk-700"><Num>{x.absent}</Num> غائب</p>
                    )}
                  </div>
                ))}
              </div>

              {/* من غاب الأسبوع كلّه */}
              {h.absentees.length > 0 && (
                <p className="mx-6 mb-4 rounded-lg border border-risk-200 bg-risk-100/50 px-3.5 py-2.5 text-panel text-risk-700">
                  غاب الأسبوع كلّه: {h.absentees.join('، ')}
                </p>
              )}

              {/* طلاب الحلقة */}
              {isOpen && (
                <div className="fade overflow-x-auto border-t border-ink-150">
                  <table className="w-full min-w-[40rem] border-collapse text-body">
                    <thead>
                      <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                        <th className="px-4 py-2.5 text-start font-medium">الطالب</th>
                        {WEEKDAY_AR.map((w) => (
                          <th key={w} className="px-1 py-2.5 text-center font-medium">{w}</th>
                        ))}
                        <th className="px-3 py-2.5 text-center font-medium">سمّع</th>
                        <th className="px-3 py-2.5 text-center font-medium">أخطاء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h.students.map((st) => (
                        <tr key={st.id} className="border-b border-ink-150 last:border-0">
                          <td className="px-4 py-2">
                            <span className={cx('text-ink-800', st.allAbsent && 'text-risk-700')}>
                              {st.fullName}
                            </span>
                          </td>
                          {st.cells.map((c) => {
                            const I = c.status ? ICON[c.status] : Minus;
                            const key = `${st.id}|${c.day}`;
                            return (
                              <td key={c.day} className="relative px-1 py-2 text-center">
                                <button
                                  onClick={() => setCell(cell === key ? null : key)}
                                  disabled={!c.status}
                                  aria-label={`${st.fullName} — ${dayLabel(c.day)} — ${c.statusAr ?? 'لم يُسجَّل'}`}
                                  className={cx(
                                    'mx-auto grid h-7 w-7 place-items-center rounded-md border transition',
                                    c.status ? TONE[c.status] : 'border-dashed border-ink-200 text-ink-300',
                                    c.future && 'opacity-40',
                                    c.status && 'hover:shadow-soft',
                                    cell === key && 'ring-2 ring-ink-400')}>
                                  <I size={13} />
                                </button>
                                {cell === key && c.status && (
                                  <CellDetail c={c} />
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center tabular-nums text-ink-700">
                            <Num>{st.recitedDays}</Num>
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-ink-600">
                            {st.errors > 0 ? <Num>{st.errors}</Num> : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Sheet>
          );
        })}
      </div>

      <p className="mt-4 text-cap text-ink-500">
        ما يسجّله المعلم في بوابته يظهر هنا في لحظته. واليوم الذي لم يُسجَّل يظهر فارغًا —
        وهو ليس غيابًا: قد لا تكون الحلقة انعقدت، وقد لا يكون المعلم حفظ بعد.
      </p>
    </>
  );
}

/** تفصيل يوم واحد لطالب واحد — يظهر تحت الخانة التي ضُغطت. */
function CellDetail({ c }: { c: Cell }) {
  return (
    <div className="fade absolute start-1/2 z-20 mt-1.5 w-56 -translate-x-1/2 rounded-xl border border-ink-200 bg-paper p-3 text-start shadow-pop">
      <p className="flex items-center gap-1.5 text-panel font-medium text-ink-900">
        {dayLabel(c.day)} — {c.statusAr}
        {c.thobe && <Shirt size={12} className="text-ink-500" />}
      </p>
      {c.assignmentNo != null && (
        <p className="mt-0.5 text-cap text-ink-500">المقرّر <Num>{c.assignmentNo}</Num></p>
      )}
      {(c.lines ?? []).length > 0 && (
        <ul className="mt-2 space-y-1">
          {(c.lines ?? []).map((l) => (
            <li key={l.kind} className="flex items-baseline gap-1.5 text-cap">
              {l.recited
                ? <Check size={11} className="shrink-0 translate-y-0.5 text-brand-700" />
                : <Minus size={11} className="shrink-0 translate-y-0.5 text-ink-400" />}
              <span className={l.recited ? 'text-ink-700' : 'text-ink-400'}>{l.kindAr}</span>
              {l.recited && l.errors > 0 && (
                <span className="text-ink-500"><Num>{l.errors}</Num> خطأ</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {c.incomplete && <p className="mt-1.5 text-cap text-warn-700">تسميع ناقص</p>}
      {c.note && <p className="mt-1.5 text-cap text-ink-600">«{c.note}»</p>}
      {c.savedBy && (
        <p className="mt-1.5 text-micro text-ink-400">
          سجّله {c.savedBy}{c.savedByRole === 'SUPERVISOR' ? ' (مشرف)' : ''}
        </p>
      )}
    </div>
  );
}
