'use client';
/* تقرير تسجيل المعلم — أسبوع حلقة على ورقة واحدة، عرضية.

   «فيه أسماء الطلاب في صفوف والأيام في أعمدة، وفيها ٤ خانات لكل من الثوب والدرس
   والمراجعتين، والحضور أو التأخير يُعلَّم يومه بلون الحالة أخضر أو أصفر، والغائب
   يُسجَّل يومه بـ«-»، وتكون بيانات لأسبوع واحد، وآخر عمود في خانة فارس ويضع صح
   إذا كان الطالب فارسًا أو رقمًا لتحديد كم يوم أنجز» (client, 18 Sep 2026).

   This is the teacher's own week read back as he would have written it on paper,
   and it is LANDSCAPE for the same reason الورقة الأسبوعية is: five days times
   four marks plus a name and a verdict is twenty-two columns, and twenty-two
   columns do not fit a portrait page at a size anyone reads.

   EVERY MARK CARRIES A SHAPE AS WELL AS A COLOUR (DESIGN.md §1.4), because this
   comes out of a photocopier: the day's tint says حاضر or متأخر, but so does the
   glyph in its corner, and an absent day is a dash rather than an empty cell —
   «الغائب يُسجَّل يومه بـ-» — so a blank can only ever mean «لم يُسجَّل», which is
   a different thing and must not be readable as absence.

   WHO THE ROW IS, then what he did: المسار والمستوى والمقرّر قبل الأيام «وأضف
   عمود المسار والمستوى وأي مقرّر وصل له، ووسّع خلايا المقررات» (client, 18 Sep
   2026). The name gave up the width for them — a name is read once and the
   marks are read twenty times, and a tick that has to be aimed at is a tick
   that gets misread. */
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits } from '@/components/Num';
import { Btn } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import { WEEKDAY_AR } from '@/lib/teacher';
import { asDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Cell = {
  day: string; status: string | null; thobe: boolean;
  dars: boolean; sughra: boolean; kubra: boolean; exam: boolean;
};
type Row = {
  id: string; fullName: string;
  trackAr: string | null; level: number | null; assignmentNo: number | null;
  cells: Cell[]; knight: boolean; met: number; of: number;
};
type Payload = {
  from: string; to: string;
  halaqa: { name: string; teacher: string; timeSlot: string } | null;
  days: string[];
  rows: Row[];
};

/* The four marks, in the order the sheet reads them. */
const MARKS: { key: keyof Pick<Cell, 'thobe' | 'kubra' | 'sughra' | 'dars'>; label: string }[] = [
  { key: 'thobe',  label: 'ث' },
  { key: 'kubra',  label: 'ك' },
  { key: 'sughra', label: 'ص' },
  { key: 'dars',   label: 'د' },
];

/** The day's own ground — and its shape, for the photocopy. */
const TONE: Record<string, { bg: string; mark: string }> = {
  PRESENT: { bg: 'bg-ok-100', mark: '●' },
  LATE:    { bg: 'bg-warn-100', mark: '◐' },
  ABSENT:  { bg: 'bg-risk-100', mark: '✕' },
};

function RegistrationSheet() {
  const sp = useSearchParams();
  const halaqa = sp.get('halaqa');
  const to = sp.get('to');

  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const q = [halaqa && `halaqa=${halaqa}`, to && `to=${to}`].filter(Boolean).join('&');
    fetch(`/api/admin/registration${q ? `?${q}` : ''}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErr(j.error ?? 'تعذّر تحميل التقرير.'); return; }
        setD(j);
      })
      .catch(() => setErr('تعذّر الاتصال.'));
  }, [halaqa, to]);

  const days = d?.days ?? [];
  const rows = d?.rows ?? [];

  return (
    <>
      {/* A page box is per-DOCUMENT, so the landscape sheet declares its own —
          the same line الورقة الأسبوعية carries, and for the same reason. */}
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>

      <div className="no-print mx-auto mb-4 flex w-[1123px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 landscape font-sans" dir="rtl">
        <header className="mb-5 flex items-center justify-between gap-4 border-b-2 border-brand-700 pb-3">
          <LogoMark height={38} white={false} />
          <div className="text-center">
            <h1 className="font-display text-h1 text-ink-900">تسجيل المعلم — أسبوع</h1>
            <p className="mt-0.5 text-sm2 text-ink-600">
              {d?.halaqa ? `${d.halaqa.name} — ${d.halaqa.teacher} · ${d.halaqa.timeSlot}`
                : 'حلقات جامع محمد العبدالكريم'}
              {d && (
                <>
                  {' · '}
                  <Num>{toArabicDigits(formatDate(d.from))}</Num>
                  {' — '}
                  <Num>{toArabicDigits(formatDate(d.to))}</Num>
                </>
              )}
            </p>
          </div>
          <LogoJamiyah height={38} />
        </header>

        {err ? (
          <p className="py-16 text-center text-lg2 text-risk-700">{err}</p>
        ) : !d ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel h-8 rounded" />)}
          </div>
        ) : days.length === 0 ? (
          <p className="py-16 text-center text-lg2 text-ink-500">
            لم يُسجَّل يوم حلقة في هذه المدة.
          </p>
        ) : (
          /* table-fixed, so the slack goes where it was asked to go: every
             column that names WHO the boy is has its width, and what is left
             over is shared equally by the mark cells rather than swelling the
             name or the verdict. */
          <table className="w-full table-fixed border-collapse text-cap">
            <thead>
              <tr>
                <th rowSpan={2}
                  className="w-[112px] border border-ink-200 bg-brand-50 px-1.5 py-1.5 text-start align-bottom font-medium">
                  الطالب
                </th>
                {/* من هو، قبل ما صنع */}
                {['المسار', 'المستوى', 'المقرّر'].map((h) => (
                  <th key={h} rowSpan={2}
                    className="w-[46px] border border-ink-200 bg-brand-50 px-1 py-1.5 text-center align-bottom font-medium">
                    {h}
                  </th>
                ))}
                {days.map((day) => {
                  const dd = asDate(day);
                  return (
                    <th key={day} colSpan={MARKS.length}
                      className="border border-ink-200 bg-brand-50 px-1 py-1 text-center font-medium">
                      <span className="block">{dd ? WEEKDAY_AR[dd.getDay()] : '—'}</span>
                      <span className="block text-[9px] font-normal text-ink-500">
                        <Num>{toArabicDigits(formatDate(day).slice(5))}</Num>
                      </span>
                    </th>
                  );
                })}
                <th rowSpan={2}
                  className="w-[54px] border border-ink-200 bg-brand-50 px-1 py-1.5 text-center align-bottom font-medium">
                  فارس
                </th>
              </tr>
              <tr>
                {days.map((day) => MARKS.map((m) => (
                  <th key={`${day}-${m.key}`}
                    className="border border-ink-200 bg-page px-0 py-0.5 text-center text-[9px] font-normal text-ink-500">
                    {m.label}
                  </th>
                )))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="border border-ink-200 px-1.5 py-1 text-start leading-tight">
                    {r.fullName}
                  </td>
                  <td className="border border-ink-200 px-1 py-1 text-center text-ink-600">
                    {r.trackAr ?? '—'}
                  </td>
                  <td className="border border-ink-200 px-1 py-1 text-center text-ink-600">
                    {r.level == null ? '—' : <Num>{toArabicDigits(String(r.level))}</Num>}
                  </td>
                  <td className="border border-ink-200 px-1 py-1 text-center text-ink-600">
                    {r.assignmentNo == null ? '—'
                      : <Num>{toArabicDigits(String(r.assignmentNo))}</Num>}
                  </td>
                  {r.cells.map((c) => {
                    const tone = c.status ? TONE[c.status] : null;
                    /* «الغائب يُسجَّل يومه بـ-» — and an unregistered day stays
                       blank, because those are different facts. */
                    const absent = c.status === 'ABSENT';
                    return MARKS.map((m, i) => (
                      <td key={`${c.day}-${m.key}`}
                        className={cx('border border-ink-200 px-0 py-1.5 text-center text-[11px]',
                          tone?.bg ?? 'bg-white')}>
                        {i === 0 && tone && (
                          <span className="me-px text-[8px] text-ink-500">{tone.mark}</span>
                        )}
                        {absent ? (i === 0 ? '—' : '')
                          : c.exam && i === 0 ? '★'
                          : c[m.key] ? '✓' : ''}
                      </td>
                    ));
                  })}
                  {/* «صح إذا كان الطالب فارسًا، أو رقمًا لتحديد كم يوم أنجز» */}
                  <td className={cx('border border-ink-200 px-1 py-1 text-center font-medium',
                    r.knight ? 'bg-brand-100 text-brand-800' : 'text-ink-600')}>
                    {r.knight ? '✓' : <Num>{toArabicDigits(r.met)}</Num>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-ink-150 pt-2.5 text-micro text-ink-500">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>ث الثوب · ك المراجعة الكبرى · ص المراجعة الصغرى · د الدرس</span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-2.5 border border-ink-200 bg-ok-100" />● حاضر
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-2.5 border border-ink-200 bg-warn-100" />◐ متأخر
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-2.5 border border-ink-200 bg-risk-100" />✕ غائب — يومه «—»
            </span>
            <span>★ اختبار اجتازه</span>
          </span>
          <span>
            الفارس: أتمّ كل أيام الأسبوع المسجَّلة حاضرًا في وقته بثوبه ومسمّعًا الثلاثة —
            والرقم عدد ما أتمّ منها
          </span>
        </footer>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><RegistrationSheet /></Suspense>;
}
