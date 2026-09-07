'use client';
/* «بنود النقاط» — the two lists the point dialogs offer.
   §8 dictates today's, and they are the defaults; a halaqa that starts a new
   activity has to be able to add a band without a redeploy. */
import { useEffect, useState } from 'react';
import { Save, RotateCcw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn } from '@/components/ui';
import { ListSettings } from '@/components/ListSettings';
import { useDB } from '@/lib/store';
import {
  REASONS_KEY, PURPOSES_KEY, DEFAULT_REASONS, DEFAULT_PURPOSES, readList,
} from '@/lib/settings';

const tally = (values: (string | null | undefined)[]) => {
  const m: Record<string, number> = {};
  for (const v of values) { const k = (v ?? '').trim(); if (k) m[k] = (m[k] ?? 0) + 1; }
  return m;
};

export function BandsSettingsCard() {
  const db = useDB();
  const [saved, setSaved] = useState<{ reasons: string[]; purposes: string[] } | null>(null);
  const [reasons, setReasons] = useState(DEFAULT_REASONS);
  const [purposes, setPurposes] = useState(DEFAULT_PURPOSES);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : {}) as Promise<Record<string, unknown>>)
      .then((all) => {
        const r = readList(all?.[REASONS_KEY], DEFAULT_REASONS);
        const p = readList(all?.[PURPOSES_KEY], DEFAULT_PURPOSES);
        setSaved({ reasons: r, purposes: p }); setReasons(r); setPurposes(p);
      })
      .catch(() => setErr('تعذّر قراءة البنود من الخادم.'));
  }, []);

  /* How many rows already carry each band, so removing a used one is a
     decision rather than a surprise. */
  const usedReasons = tally(db.txns.map((t) => t.reason));
  const usedPurposes = tally(db.batches.map((b) => b.purpose));

  const dirty = saved !== null
    && JSON.stringify(saved) !== JSON.stringify({ reasons, purposes });

  const save = async () => {
    setBusy(true); setErr(''); setDone(false);
    const clean = { reasons: readList(reasons, DEFAULT_REASONS), purposes: readList(purposes, DEFAULT_PURPOSES) };
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [REASONS_KEY]: clean.reasons, [PURPOSES_KEY]: clean.purposes }),
      });
      if (!res.ok) throw new Error();
      setSaved(clean); setReasons(clean.reasons); setPurposes(clean.purposes);
      setDone(true); setTimeout(() => setDone(false), 3000);
    } catch { setErr('تعذّر الحفظ. تأكّد من الاتصال ثم أعد المحاولة.'); }
    setBusy(false);
  };

  return (
    <Sheet className="rise mb-4">
      <SheetHead title="بنود النقاط" meta="ما تعرضه قائمتا «سبب الشحن» و«غرض الأكواد»" />

      <div className="grid gap-6 lg:grid-cols-2">
        <ListSettings label="سبب شحن النقاط" hint="في نافذة «شحن نقاط»"
          items={reasons} onChange={setReasons} defaults={DEFAULT_REASONS} used={usedReasons} />
        <ListSettings label="غرض دفعة الأكواد" hint="في نافذة «إصدار دفعة أكواد»"
          items={purposes} onChange={setPurposes} defaults={DEFAULT_PURPOSES} used={usedPurposes} />
      </div>

      <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-info-100 px-3.5 py-3 text-panel text-info-700">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        تغيير اسم بند لا يُعيد كتابة ما مضى — السجلات القديمة تبقى بالكلمة التي كُتبت بها،
        فتقرير الفصل الماضي يقرأ كما كان. وحذف بند يُخفيه من القائمة فقط.
      </p>

      {err && (
        <p role="alert" className="mt-3 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
          {err}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn variant="primary" icon={busy ? undefined : Save} disabled={!dirty || busy} onClick={save}>
          {busy ? <><Loader2 size={16} className="animate-spin" /> جارٍ الحفظ…</> : 'حفظ البنود'}
        </Btn>
        <Btn icon={RotateCcw} disabled={busy}
          onClick={() => { setReasons(DEFAULT_REASONS); setPurposes(DEFAULT_PURPOSES); }}>
          إرجاع الكل إلى المعتمد
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
