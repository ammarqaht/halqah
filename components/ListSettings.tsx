'use client';
/* An editable list of bands — «بنود النقاط».
   Add, rename, reorder, remove. What the two dropdowns offer, and nothing more
   clever than that: they are labels the halaqa chose, so they are text, and
   they stay text on every row ever written with them.

   Renaming a band does NOT rewrite history. A grant recorded as «مسابقة» keeps
   that word even if the band is later called «المسابقة الشهرية» — §3.5 makes
   the ledger append-only, and a report of last term must read as it did. The
   screen says so rather than leaving it to be discovered. */
import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { Btn, INPUT } from '@/components/ui';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';

export function ListSettings({ label, hint, items, onChange, defaults, used }: {
  label: string;
  hint: string;
  items: string[];
  onChange: (next: string[]) => void;
  defaults: string[];
  /** How many rows already carry each band — a used band warns before removal. */
  used?: Record<string, number>;
}) {
  const [fresh, setFresh] = useState('');

  const add = () => {
    const t = fresh.replace(/\s+/g, ' ').trim();
    if (!t || items.includes(t)) { setFresh(''); return; }
    onChange([...items, t]);
    setFresh('');
  };

  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const rename = (i: number, v: string) =>
    onChange(items.map((x, k) => (k === i ? v : x)));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-body font-medium text-ink-900">{label}</h4>
        <span className="text-micro text-ink-500">{hint}</span>
      </div>

      <ul className="divide-y divide-ink-150 rounded-lg border border-ink-200">
        {items.map((item, i) => {
          const n = used?.[item] ?? 0;
          return (
            <li key={i} className="flex items-center gap-1.5 px-2 py-1.5">
              <input value={item} onChange={(e) => rename(i, e.target.value)}
                aria-label={`${label} — البند ${i + 1}`}
                className={cx(INPUT, 'h-8 flex-1 px-2 text-panel')} />
              {n > 0 && (
                <span className="shrink-0 whitespace-nowrap text-micro text-ink-500">
                  <Num>{n}</Num> سجلًا
                </span>
              )}
              <button onClick={() => move(i, -1)} disabled={i === 0}
                title="أعلى" aria-label={`رفع ${item}`}
                className="rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800 disabled:opacity-30">
                <ArrowUp size={14} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
                title="أسفل" aria-label={`تنزيل ${item}`}
                className="rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800 disabled:opacity-30">
                <ArrowDown size={14} />
              </button>
              <button
                onClick={() => onChange(items.filter((_, k) => k !== i))}
                disabled={items.length === 1}
                title={items.length === 1 ? 'لا بدّ من بند واحد على الأقل'
                     : n > 0 ? `يُحذف من القائمة — و${n} سجلًا سابقًا يبقى كما هو`
                     : 'حذف البند'}
                aria-label={`حذف ${item}`}
                className="rounded p-1.5 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700 disabled:opacity-30">
                <Trash2 size={14} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={fresh} onChange={(e) => setFresh(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="بند جديد…" aria-label={`إضافة بند إلى ${label}`}
          className={cx(INPUT, 'h-9 w-52 px-2.5 text-panel')} />
        <Btn size="sm" icon={Plus} onClick={add} disabled={!fresh.trim()}>إضافة</Btn>
        {JSON.stringify(items) !== JSON.stringify(defaults) && (
          <Btn size="sm" icon={RotateCcw} onClick={() => onChange(defaults)}>إرجاع إلى المعتمد</Btn>
        )}
      </div>
    </div>
  );
}
