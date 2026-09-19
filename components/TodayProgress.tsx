'use client';
/* تقدّم الحلقات — اليوم.

   «أبيك تعرض إحصائيات اليوم فقط، ولا تعرض متوسطات بل إجمالي، وإحصائيات الفترة
   تكون في التقارير» (client, 18 Sep 2026), ثم: «أبي نفس الجدول ونفس الأعمدة
   اللي كانت موجودة أول، لكن بس حسبة اليوم».

   So: the same table. Same columns, same order, same track chips — only the
   arithmetic changed. It used to be the last رتل file's term totals with a
   per-student average under each, on the screen the supervisor opens every
   afternoon to ask what is happening NOW. The term's figures are a report, and
   they moved to «تقدّم الحلقات — للفترة»; this is the day itself.

   TWO OF THE FIGURES ARE PAGES AND THREE ARE STUDENTS, and they are not the
   same fact. «أضف عمودين: إجمالي أوجه الحفظ، إجمالي أوجه المراجعة» (client,
   18 Sep 2026): a halaqa where twelve boys each recited half a page and one
   where three recited ten each are the same row by headcount and nothing alike
   by weight. So the pages lead each column and the headcount rides under them
   as the smaller line — the same shape the رتل table used for «للطالب».

   The page figures come from حسبة «مسارات الحفظ», which lives in the database
   and is never printed: the screen shows what it produced, not the bands
   behind it.

   THE FIGURES COME FROM THE SERVER, not from the browser's copy: التحضير is
   written in بوابة المعلم, and `PUT /api/state` never carries it. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Inbox } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { HijriText, Num } from '@/components/Num';
import { TRACK_AR, type Track } from '@/lib/types';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Row = {
  id: string; name: string; teacher: string; timeSlot: string;
  students: number; tracks: Record<string, number>;
  present: number; late: number; absent: number;
  dars: number; murajaa: number; recited: number; thobe: number;
  hifzPages: number; reviewPages: number;
  recorded: number; unrecorded: number;
};
type Totals = {
  students: number; dars: number; murajaa: number; present: number;
  late: number; absent: number; recited: number; thobe: number;
  hifzPages: number; reviewPages: number;
  recorded: number; unrecorded: number; openedHalaqat: number;
};
type Payload = { day: string; halaqat: Row[]; totals: Totals };

/* The same palette the old table used for its track dots. */
const TRACK_TONE: Record<string, string> = {
  GOLDEN: 'bg-warn-500', SILVER: 'bg-sage-500', TALQEEN: 'bg-info-500',
};

/** The day's figures, in the places the رتل ones used to sit: the page total
    first, and who it came from underneath. */
const COLS: {
  key: 'hifzPages' | 'reviewPages' | 'present';
  under: 'dars' | 'murajaa' | null;
  label: string; tone: string;
}[] = [
  { key: 'hifzPages', under: 'dars', label: 'أوجه الحفظ', tone: 'text-brand-800' },
  { key: 'reviewPages', under: 'murajaa', label: 'أوجه المراجعة', tone: 'text-brand-800' },
  { key: 'present', under: null, label: 'الحضور', tone: 'text-ok-700' },
];

/** Half a page is «٠٫٥», not «٠» and not «0.50». */
const pages = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function TodayProgress() {
  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/admin/today')
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErr(j.error ?? 'تعذّر قراءة اليوم.'); return; }
        setD(j);
      })
      .catch(() => setErr('تعذّر الاتصال بالخادم.'));
  }, []);

  return (
    <Sheet className="rise mb-4">
      <SheetHead title="تقدّم الحلقات — اليوم"
        meta={d
          ? <span>
              <Num>{formatDate(d.day)}</Num> · <HijriText day={d.day} /> — عددًا لا متوسطًا
            </span>
          : 'ما سجّله المعلمون اليوم'}
        action={
          /* اليوم هنا، والأسبوع في الكشف، والفترة في التقارير — ثلاثة مدَيات
             وثلاثة أبواب، فلا يبحث المشرف عن الأمس في شاشة اليوم. */
          <span className="flex items-center gap-4">
            <Link href="/admin/follow-up?list=register"
              className="flex items-center gap-1 text-xs2 text-brand-800 hover:underline">
              كشف الأسبوع <ArrowLeft size={14} strokeWidth={2} /></Link>
            <Link href="/admin/reports?r=progress"
              className="flex items-center gap-1 text-xs2 text-brand-800 hover:underline">
              إحصائيات الفترة <ArrowLeft size={14} strokeWidth={2} /></Link>
          </span>} />

      {err ? (
        <p className="py-6 text-center text-panel text-ink-500">{err}</p>
      ) : !d ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="skel h-9 rounded" />)}
        </div>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-body">
            <thead>
              <tr className="border-b border-ink-200 text-cap text-ink-500">
                <th className="px-2 pb-2.5 text-start font-medium">الحلقة</th>
                <th className="px-2 pb-2.5 text-start font-medium">الطلاب</th>
                <th className="px-2 pb-2.5 text-start font-medium">المسار</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-2 pb-2.5 text-start font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.halaqat.map((h) => (
                <tr key={h.id}
                  className={cx('border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50',
                    h.recorded === 0 && 'opacity-60')}>
                  <td className="px-2 py-3">
                    <span className="block font-medium text-ink-900">{h.teacher}</span>
                    {/* An afternoon nobody has opened is not an afternoon of
                        noughts — and the difference is the first thing the
                        supervisor needs from this row. */}
                    <span className="block text-micro text-ink-500">
                      {h.recorded === 0
                        ? 'لم يفتح التسجيل بعد'
                        : <>سُجِّل <Num>{h.recorded}</Num> من <Num>{h.students}</Num></>}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <span className="text-panel text-ink-700"><Num>{h.students}</Num></span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex gap-1">
                      {Object.entries(h.tracks).map(([k, v]) => (
                        <span key={k}
                          className="inline-flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5 text-2xs text-ink-700">
                          <span className={cx('h-1.5 w-1.5 rounded-full', TRACK_TONE[k] ?? 'bg-ink-300')} />
                          {TRACK_AR[k as Track] ?? k} <Num>{v}</Num>
                        </span>
                      ))}
                    </div>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-2 py-3">
                      <span className={cx('text-panel', h[c.key] === 0 ? 'text-ink-300' : c.tone)}>
                        <Num>{c.under ? pages(h[c.key]) : h[c.key]}</Num>
                      </span>
                      {/* من أتى بها — عددًا، تحت الأوجه. */}
                      {c.under && h[c.under] > 0 && (
                        <span className="block text-micro text-ink-500">
                          <Num>{h[c.under]}</Num> سمّعوا
                        </span>
                      )}
                      {/* متأخر وغائب لا عمود لهما — يركبان مع الحضور، لأن الرقم
                          الذي يُقرأ هو «كم حضر»، وما بعده تفصيله. */}
                      {c.key === 'present' && (h.late > 0 || h.absent > 0) && (
                        <span className="block text-micro text-ink-500">
                          {h.late > 0 && <>متأخر <Num>{h.late}</Num></>}
                          {h.late > 0 && h.absent > 0 && ' · '}
                          {h.absent > 0 && <>غائب <Num>{h.absent}</Num></>}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-200 font-medium">
                <td className="px-2 py-3 text-ink-900">
                  الإجمالي
                  <span className="ms-2 text-micro font-normal text-ink-500">
                    <Num>{d.totals.openedHalaqat}</Num> من <Num>{d.halaqat.length}</Num> فتحت التسجيل
                  </span>
                </td>
                <td className="px-2 py-3"><Num className="text-panel text-ink-900">{d.totals.students}</Num></td>
                <td className="px-2 py-3" />
                {COLS.map((c) => (
                  <td key={c.key} className="px-2 py-3">
                    <Num className={cx('text-panel', c.tone)}>
                      {c.under ? pages(d.totals[c.key]) : d.totals[c.key]}
                    </Num>
                    {c.under && d.totals[c.under] > 0 && (
                      <span className="block text-micro font-normal text-ink-500">
                        <Num>{d.totals[c.under]}</Num> سمّعوا
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>

          {d.totals.recorded === 0 && (
            <p className="mt-3 flex items-center gap-2.5 rounded-xl bg-page/60 px-4 py-3 text-panel text-ink-600">
              <Inbox size={16} className="shrink-0 text-ink-400" />
              لم يُسجَّل شيء اليوم بعد — تمتلئ الأرقام فور أن يفتح كل معلّم تسجيله.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
