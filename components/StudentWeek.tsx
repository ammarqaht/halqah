'use client';
/* حضوره وتسميعه — في بطاقة الطالب عند المشرف.
 *
 * «بالطالب» gathered his plan, his readiness, his exams and his balance into
 * one card — and said nothing about whether he had been in the halaqa this
 * week. His teacher had been recording it every afternoon; the screen the
 * supervisor opens to answer «كيف حال هذا الطالب؟» could not see it.
 *
 * A week at a time, with arrows, because that is the unit a boy's attendance
 * is discussed in: «غاب الأسبوع الماضي كلّه» is a sentence; «غاب أربعة من
 * ثمانية وعشرين يومًا» is arithmetic nobody asked for.
 */
import { useEffect, useState } from 'react';
import { CalendarX } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Num } from '@/components/Num';
import { WeekStrip, DayDetail, type StripDay } from '@/components/WeekStrip';
import { WeekBar } from '@/components/WeekBar';

type Payload = {
  today: string; week: string; prevWeek: string; nextWeek: string | null;
  isThisWeek: boolean; days: StripDay[]; ever: number;
  summary: { recorded: number; present: number; late: number; absent: number; recited: number };
};

export function StudentWeek({ studentId }: { studentId: string }) {
  const [d, setD] = useState<Payload | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* A different boy is a different history — start him on the current week. */
  useEffect(() => { setWeek(null); setOpen(null); }, [studentId]);

  useEffect(() => {
    setBusy(true);
    const q = new URLSearchParams({ student: studentId });
    if (week) q.set('week', week);
    fetch(`/api/admin/register/student?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) { setD(j); setOpen(null); } })
      .catch(() => { /* the card simply does not appear */ })
      .finally(() => setBusy(false));
  }, [studentId, week]);

  if (!d) return <div className="skel h-[190px] rounded-2xl" />;

  if (d.ever === 0) {
    return (
      <Sheet>
        <SheetHead title="حضوره وتسميعه" meta="من سجلّ معلمه" />
        <p className="flex items-center gap-2 py-3 text-base2 text-ink-500">
          <CalendarX size={16} className="shrink-0" />
          لم يسجّل له معلمه شيئًا بعد.
        </p>
      </Sheet>
    );
  }

  const shown = d.days.find((x) => x.day === open) ?? null;

  return (
    <Sheet>
      <SheetHead title="حضوره وتسميعه" meta="من سجلّ معلمه" />

      <div className="mb-3">
        <WeekBar size="sm" week={d.week} isThisWeek={d.isThisWeek}
          prevWeek={d.prevWeek} nextWeek={d.nextWeek} onChange={setWeek} busy={busy} />
      </div>

      <WeekStrip days={d.days} today={d.today} onPick={setOpen} picked={open} />

      {shown && <DayDetail d={shown} />}

      {d.summary.recorded > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-panel text-ink-600">
          <span><Num className="font-medium text-ink-900">{d.summary.present}</Num> حاضر</span>
          {d.summary.late > 0 && (
            <span><Num className="font-medium text-ink-900">{d.summary.late}</Num> متأخر</span>
          )}
          <span><Num className="font-medium text-ink-900">{d.summary.absent}</Num> غائب</span>
          <span><Num className="font-medium text-ink-900">{d.summary.recited}</Num> يوم سمّع فيه</span>
        </div>
      ) : (
        <p className="mt-3 text-panel text-ink-500">
          {d.isThisWeek ? 'لم يُسجَّل له شيء هذا الأسبوع بعد.' : 'لا تسجيل في هذا الأسبوع.'}
        </p>
      )}
    </Sheet>
  );
}
