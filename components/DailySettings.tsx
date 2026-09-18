'use client';
/* بنود النقاط اليومية وأيام الحلقة — §١٣ و القسم الثامن.

   Two settings the teacher's portal added, and they belong together because both
   are things a supervisor decides once and the whole portal then computes from.

   TWO COLUMNS, BOTH TYPED. The golden track used to be a MULTIPLIER over the
   silver one — ×٢ on the three recitation lines, ×١ on الحضور and الثوب, with the
   split itself an open question we had put to the client. He closed it on
   18 Sep 2026: «أبي خانة الذهبي قابلة للتعديل، والمضاعفة تشمل الحضور والثوب
   وليست مفصولة». So ذهبي is a column of five figures like فضي, and the
   multiplier survives only as a way to FILL it in one stroke — one factor over
   all five, which is «ليست مفصولة» made structural rather than argued.

   That is also the shape of the client's own paper, which lists فضي and ذهبي as
   rows of one table and never mentions a factor at all.

   And the weekdays: NOT a gate. «أيّ يوم يكون فيه تحضير يُعتبر يوم حلقة» — these
   are the days that open by THEMSELVES, and a Friday a halaqa is held on is
   opened by hand and counts the same once it is. Which is why there is no
   holidays list here: a day nobody registered is not a halaqa day. */
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, CheckCircle2, Loader2, RotateCcw, Save, Wand2,
} from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, INPUT_BARE } from '@/components/ui';
import { Num } from '@/components/Num';
import {
  DAILY_POINTS_KEY, DEFAULT_DAILY, isDefaultDaily, readDaily,
  readWeekdays, WEEKDAYS_KEY,
  type DailyPointsSettings, type WeekdaysSettings,
} from '@/lib/settings';
import { DAILY_ITEM_AR, WEEKDAY_AR, applyFactor, type DailyPointItems } from '@/lib/teacher';
import { cx } from '@/lib/cx';

const ITEMS: (keyof DailyPointItems)[] =
  ['ATTENDANCE', 'THOBE', 'MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS'];

const TRACKS = [
  { key: 'items' as const, label: 'الفضي' },
  { key: 'golden' as const, label: 'الذهبي' },
];

export function DailySettingsCard() {
  const [saved, setSaved] = useState<DailyPointsSettings | null>(null);
  const [draft, setDraft] = useState<DailyPointsSettings>(DEFAULT_DAILY);
  const [days, setDays] = useState<WeekdaysSettings | null>(null);
  const [daysDraft, setDaysDraft] = useState<number[]>([0, 1, 2, 3, 4]);
  const [factor, setFactor] = useState('2');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : {}) as Promise<Record<string, unknown>>)
      .then((all) => {
        const d = readDaily(all?.[DAILY_POINTS_KEY]);
        setSaved(d); setDraft(d);
        const w = readWeekdays(all?.[WEEKDAYS_KEY]);
        setDays(w); setDaysDraft(w.default);
      })
      .catch(() => setErr('تعذّر قراءة الإعدادات من الخادم.'));
  }, []);

  const dirty = (saved !== null && JSON.stringify(saved) !== JSON.stringify(draft))
    || (days !== null && JSON.stringify(days.default) !== JSON.stringify(daysDraft));

  /* What a full day is worth on each track, which is the number that matters —
     not the five that make it. */
  const totals = useMemo(() => ({
    items: ITEMS.reduce((n, k) => n + draft.items[k], 0),
    golden: ITEMS.reduce((n, k) => n + draft.golden[k], 0),
  }), [draft]);

  const set = (track: 'items' | 'golden', k: keyof DailyPointItems, v: string) =>
    setDraft((p) => ({
      ...p,
      [track]: { ...p[track], [k]: Math.max(0, Number(v.replace(/\D/g, '')) || 0) },
    }));

  const save = async () => {
    setBusy(true); setErr(''); setDone(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [DAILY_POINTS_KEY]: draft,
          [WEEKDAYS_KEY]: { ...(days ?? { byHalaqa: {} }), default: daysDraft },
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(draft);
      setDays((w) => ({ byHalaqa: w?.byHalaqa ?? {}, default: daysDraft }));
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch { setErr('تعذّر الحفظ. تأكّد من الاتصال ثم أعد المحاولة.'); }
    setBusy(false);
  };

  return (
    <Sheet className="rise mb-4">
      <SheetHead title="النقاط اليومية وأيام الحلقة"
        meta="ما يحسبه النظام من تسجيل المعلم، والأيام التي يفتح فيها اليوم نفسه"
        action={saved && !isDefaultDaily(saved)
          ? <Chip tone="warn">مُعدَّلة عن المعتمد</Chip> : undefined} />

      {/* ── البنود، عمودًا لكل مسار ───────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-body">
          <thead>
            <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
              <th className="px-3 py-2.5 text-start font-medium">البند</th>
              {TRACKS.map((t) => (
                <th key={t.key} className="px-3 py-2.5 text-start font-medium">
                  المسار {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((k) => (
              <tr key={k} className="border-b border-ink-150 last:border-0">
                <td className="px-3 py-2.5 text-ink-800">{DAILY_ITEM_AR[k]}</td>
                {TRACKS.map((t) => {
                  const changed = saved && saved[t.key][k] !== draft[t.key][k];
                  return (
                    <td key={t.key} className="px-1.5 py-1.5">
                      <input inputMode="numeric" value={String(draft[t.key][k])}
                        aria-label={`نقاط ${DAILY_ITEM_AR[k]} — المسار ${t.label}`}
                        onChange={(e) => set(t.key, k, e.target.value)}
                        className={cx(INPUT_BARE, 'h-10 w-24 text-center tabular-nums',
                          changed && 'border-brand-700 bg-brand-50')} />
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-ink-200 bg-page/40">
              <td className="px-3 py-2.5 font-medium text-ink-900">يوم كامل</td>
              {TRACKS.map((t) => (
                <td key={t.key} className="px-3 py-2.5">
                  <Num className="font-bold tabular-nums text-ink-900">{totals[t.key]}</Num>
                  <span className="ms-1 text-cap text-ink-500">نقطة</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── المضاعفة: أداة تملأ العمود، لا قاعدة تحسب عند الدفع ──────────── */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-ink-150 bg-page/40 p-4">
        <label className="block">
          <span className="mb-1 block text-xs2 text-ink-600">املأ الذهبي بمضاعفة الفضي</span>
          <input inputMode="numeric" value={factor} aria-label="المضاعفة"
            onChange={(e) => setFactor(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className={cx(INPUT_BARE, 'h-10 w-20 text-center tabular-nums')} />
        </label>
        <Btn icon={Wand2} className="h-10"
          onClick={() => setDraft((p) => ({
            ...p, golden: applyFactor(p.items, Number(factor) || 1) }))}>
          طبّقها
        </Btn>
        <p className="min-w-[14rem] flex-1 text-panel leading-relaxed text-ink-600">
          تشمل البنود الخمسة كلها — الحضور والثوب معها. وهي زرّ يكتب الأرقام مرة
          واحدة، لا قاعدة تُحسب عند الدفع: ما تراه في عمود الذهبي هو ما يُصرف.
        </p>
      </div>

      {/* ── أيام الحلقة ──────────────────────────────────────────────────── */}
      <div className="mt-4 rounded-xl border border-ink-150 bg-page/40 p-4">
        <p className="flex items-center gap-2 text-body font-medium text-ink-900">
          <CalendarDays size={16} className="text-ink-500" />
          أيام انعقاد الحلقة
        </p>
        <p className="mt-1 text-panel leading-relaxed text-ink-600">
          هذه هي الأيام التي <strong>يفتح فيها اليوم نفسه</strong> عند المعلم، وليست
          قيدًا: أيّ يوم فيه تحضير يُحسب يوم حلقة، فالجمعة التي تنعقد فيها الحلقة
          يفتحها المعلم بضغطة وتُحسب مثلها. ويومٌ لم يُسجَّل فيه أحد ليس يوم حلقة
          أصلًا — فلا إجازات تُعرَّف، ولا إجازة تظهر غيابًا.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {WEEKDAY_AR.map((label, i) => {
            const on = daysDraft.includes(i);
            return (
              <button key={i} type="button"
                onClick={() => setDaysDraft((d) => {
                  const next = on ? d.filter((x) => x !== i) : [...d, i].sort((a, b) => a - b);
                  /* A halaqa no day ever opens for would face its teacher with a
                     card that never offers him his own afternoon. */
                  return next.length ? next : d;
                })}
                aria-pressed={on}
                className={cx('rounded-lg border-2 px-3 py-2 text-panel font-medium transition-colors',
                  on ? 'border-brand-700 bg-brand-100 text-brand-800'
                     : 'border-ink-200 bg-paper text-ink-600')}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {err && (
        <p role="alert" className="mt-3 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
          {err}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn variant="primary" icon={busy ? undefined : Save} disabled={!dirty || busy} onClick={save}>
          {busy ? <><Loader2 size={16} className="animate-spin" /> جارٍ الحفظ…</> : 'احفظ'}
        </Btn>
        <Btn icon={RotateCcw} disabled={busy || JSON.stringify(draft) === JSON.stringify(DEFAULT_DAILY)}
          onClick={() => setDraft(DEFAULT_DAILY)}>
          إرجاع إلى المعتمد
        </Btn>
        {done && (
          <span className="fade flex items-center gap-1.5 text-panel text-ok-700">
            <CheckCircle2 size={15} /> حُفظت
          </span>
        )}
      </div>
    </Sheet>
  );
}
