'use client';
/* تخصيص النقاط — §13.5 and §4.6.
   What passing an exam is worth, per track. The figures the client approved are
   the defaults; these are the same numbers with a way to reach them, because
   the halaqa decided them and may decide otherwise.

   Two things this screen has to be honest about: a change reaches only exams
   recorded AFTER it — a boy already paid two hundred keeps them, since §3.5
   makes the ledger append-only — and تلقين earns nothing at all, which is not
   a figure anyone can edit. */
import { useEffect, useState } from 'react';
import { Coins, Save, RotateCcw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, INPUT, Chip } from '@/components/ui';
import { Num } from '@/components/Num';
import { EXAM_TYPE_AR } from '@/lib/points';
import { TRACK_AR } from '@/lib/types';
import {
  DEFAULT_POINTS, POINTS_KEY, readPoints, isDefaultPoints, type PointsSettings,
} from '@/lib/settings';
import { cx } from '@/lib/cx';

const TRACKS = ['SILVER', 'GOLDEN'] as const;
/* Only these three carry a fixed figure. MOCK is always zero and TAJWEED is
   typed at the desk, so neither is a setting — they are stated below instead. */
type Scored = 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | 'ASSOCIATION';
const TYPES: Scored[] = ['BADGE_GOLDEN', 'BADGE_DIAMOND', 'ASSOCIATION'];

export function PointsSettingsCard() {
  const [saved, setSaved] = useState<PointsSettings | null>(null);
  const [draft, setDraft] = useState<PointsSettings>(DEFAULT_POINTS);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : {}) as Promise<Record<string, unknown>>)
      .then((all) => {
        const p = readPoints(all?.[POINTS_KEY]);
        setSaved(p); setDraft(p);
      })
      .catch(() => setErr('تعذّر قراءة الإعدادات من الخادم.'));
  }, []);

  const dirty = saved !== null && JSON.stringify(saved) !== JSON.stringify(draft);

  const set = (track: typeof TRACKS[number], type: Scored, v: string) =>
    setDraft((p) => ({ ...p, [track]: { ...p[track], [type]: Number(v.replace(/[^\d]/g, '')) || 0 } }));

  const save = async () => {
    setBusy(true); setErr(''); setDone(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [POINTS_KEY]: draft }),
      });
      if (!res.ok) throw new Error();
      setSaved(draft); setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch { setErr('تعذّر الحفظ. تأكّد من الاتصال ثم أعد المحاولة.'); }
    setBusy(false);
  };

  return (
    <Sheet className="rise mb-4">
      <SheetHead title="تخصيص النقاط"
        meta="ما يُمنح على اجتياز كل اختبار، لكل مسار"
        action={saved && !isDefaultPoints(saved) ? <Chip tone="warn">مُعدَّلة عن المعتمد</Chip> : undefined} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-body">
          <thead>
            <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
              <th className="px-3 py-2.5 text-start font-medium">الاختبار</th>
              {TRACKS.map((t) => (
                <th key={t} className="px-3 py-2.5 text-start font-medium">{TRACK_AR[t]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPES.map((type) => (
              <tr key={type} className="border-b border-ink-150 last:border-0">
                <td className="px-3 py-2.5 text-ink-800">{EXAM_TYPE_AR[type]}</td>
                {TRACKS.map((track) => {
                  const changed = saved && saved[track][type] !== draft[track][type];
                  return (
                    <td key={track} className="px-1.5 py-1.5">
                      <input inputMode="numeric" value={String(draft[track][type])}
                        aria-label={`نقاط ${EXAM_TYPE_AR[type]} — ${TRACK_AR[track]}`}
                        onChange={(e) => set(track, type, e.target.value)}
                        className={cx(INPUT, 'h-9 w-28 px-2.5 tabular-nums',
                          changed && 'border-brand-700 bg-brand-50')} />
                      {DEFAULT_POINTS[track][type] !== draft[track][type] && (
                        <span className="ms-2 text-micro text-ink-400">
                          المعتمد <Num>{DEFAULT_POINTS[track][type]}</Num>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Stated, not editable — §13.1 puts talqeen outside the system. */}
            <tr className="border-t border-ink-200 bg-page/40">
              <td className="px-3 py-2.5 text-panel text-ink-500">التلقين</td>
              <td className="px-3 py-2.5 text-panel text-ink-500" colSpan={2}>
                خارج نظام النقاط — لا مستوى له ولا منهج، فلا نقاط.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2.5 text-panel text-ink-500">اختبار التجويد</td>
              <td className="px-3 py-2.5 text-panel text-ink-500" colSpan={2}>
                تكتب نقاطه عند التسجيل — لا رقم ثابت له.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2.5 text-panel text-ink-500">الاختبار التجريبي</td>
              <td className="px-3 py-2.5 text-panel text-ink-500" colSpan={2}>
                بروفة قبل الجمعية، ولا نقاط عليه.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-info-100 px-3.5 py-3 text-panel text-info-700">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        التغيير يسري على الاختبارات التي تُسجَّل بعده فقط. النقاط المصروفة سابقًا تبقى كما هي —
        السجل لا يُعدَّل بأثر رجعي.
      </p>

      {err && (
        <p role="alert" className="mt-3 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
          {err}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn variant="primary" icon={busy ? undefined : Save} disabled={!dirty || busy} onClick={save}>
          {busy ? <><Loader2 size={16} className="animate-spin" /> جارٍ الحفظ…</> : 'حفظ النقاط'}
        </Btn>
        <Btn icon={RotateCcw} disabled={busy || JSON.stringify(draft) === JSON.stringify(DEFAULT_POINTS)}
          onClick={() => setDraft(DEFAULT_POINTS)}>
          إرجاع إلى المعتمد
        </Btn>
        {done && (
          <span className="fade flex items-center gap-1.5 text-panel text-ok-700">
            <CheckCircle2 size={15} /> حُفظت
          </span>
        )}
        {!saved && !err && (
          <span className="flex items-center gap-1.5 text-panel text-ink-500">
            <Coins size={15} /> جارٍ القراءة…
          </span>
        )}
      </div>
    </Sheet>
  );
}
