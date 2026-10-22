'use client';
/* المتجر للطلاب: عرض فقط، أو مفتوح للطلب — the supervisor's one switch.
   «نبي نسوي طريقة بس عرض دون الطلب … بعدين ممكن نفتح الطلب» (client,
   22 Oct 2026). The rule itself is lib/storeMode; this only reads and writes
   the setting, and says plainly what each side means for a boy. */
import { useEffect, useState } from 'react';
import { Eye, ShoppingBag } from 'lucide-react';
import { Segmented } from '@/components/ui';
import { STORE_ORDERING_KEY, orderingOpen } from '@/lib/storeMode';
import { cx } from '@/lib/cx';

type Mode = 'VIEW' | 'OPEN';

export function StoreModeSwitch() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/settings').then((r) => (r.ok ? r.json() : null))
      .then((s) => setMode(orderingOpen(s?.[STORE_ORDERING_KEY]) ? 'OPEN' : 'VIEW'))
      .catch(() => setMode('VIEW'));
  }, []);

  const change = async (next: Mode) => {
    if (next === mode) return;
    const prev = mode;
    setMode(next); setErr('');
    const res = await fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [STORE_ORDERING_KEY]: next === 'OPEN' }),
    }).catch(() => null);
    if (!res?.ok) { setMode(prev); setErr('تعذّر الحفظ — حاول مرة أخرى.'); }
  };

  const open = mode === 'OPEN';
  const Icon = open ? ShoppingBag : Eye;

  return (
    <div data-tour="store-mode" className={cx('rise mb-6 flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4',
      open ? 'border-brand-200 bg-brand-50' : 'border-warn-200 bg-warn-100')}>
      <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full',
        open ? 'bg-brand-100 text-brand-800' : 'bg-paper text-warn-700')}>
        <Icon size={19} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-bold text-ink-900">
          متجر الطلاب: {mode === null ? '…' : open ? 'مفتوح للطلب' : 'للعرض فقط'}
        </p>
        <p className="text-panel text-ink-600">
          {open
            ? 'يرى الطلاب الهدايا ويطلبون ما تكفيه نقاطهم، فتصلك طلباتهم هنا.'
            : 'يرى الطلاب الهدايا وأسعارها وكم بقي لهم، بلا زرّ طلب — حتى تفتحه.'}
        </p>
        {err && <p className="mt-1 text-panel text-risk-700">{err}</p>}
      </div>
      {mode !== null && (
        <Segmented<Mode> value={mode} onChange={change}
          options={[{ value: 'VIEW', label: 'عرض فقط' }, { value: 'OPEN', label: 'مفتوح للطلب' }]} />
      )}
    </div>
  );
}
