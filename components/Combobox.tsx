'use client';
/* A select you can type into. The native control renders in the operating
   system's own style — a grey slab that ignores the palette, the fonts and the
   reading direction — and it cannot be searched. This one is ours: filtered as
   you type, driven from the keyboard, and portalled so a modal's overflow
   cannot clip it. */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { foldArabic } from '@/lib/normalise';
import { cx } from '@/lib/cx';

export type Option = { value: string; label: string; hint?: string };

export function Combobox({
  value, onChange, options, placeholder = 'اختر…', searchPlaceholder = 'ابحث…',
  emptyText = 'لا نتائج', id, disabled, searchableFrom = 6,
  creatable = false, createLabel = 'إضافة',
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
  disabled?: boolean;
  /** show the search field once the list is at least this long */
  searchableFrom?: number;
  /** let the supervisor type a value that isn't in the list yet */
  creatable?: boolean;
  createLabel?: string;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; above: boolean } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const selected = options.find((o) => o.value === value) ?? null;
  const searchable = creatable || options.length >= searchableFrom;

  const filtered = useMemo(() => {
    const n = foldArabic(q);
    if (!n) return options;
    return options.filter((o) => foldArabic(o.label).includes(n) || foldArabic(o.hint ?? '').includes(n));
  }, [q, options]);

  /* Anchor the list to the trigger. Measured on open and kept in step with
     scrolling, since the popup lives in <body> and not beside the field. */
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      if (!b) return;
      const room = window.innerHeight - b.bottom;
      const above = room < 260 && b.top > room;
      setRect({ top: above ? b.top : b.bottom + 6, left: b.left, width: b.width, above });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQ(''); setActive(Math.max(0, filtered.findIndex((o) => o.value === value)));
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (v: string) => { onChange(v); setOpen(false); btnRef.current?.focus(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btnRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = filtered[active]; if (o) commit(o.value); }
  };

  return (
    <>
      <button
        ref={btnRef} id={id} type="button" disabled={disabled}
        onClick={() => setOpen((o) => !o)} onKeyDown={onKey}
        role="combobox" aria-expanded={open} aria-controls={listId} aria-haspopup="listbox"
        className={cx(
          'flex h-11 w-full items-center justify-between gap-2 rounded-md border bg-paper px-3.5 text-start',
          'text-base2 transition-[border-color,box-shadow] duration-150',
          'disabled:opacity-55',
          open
            ? 'border-brand-700 shadow-[0_0_0_3px_rgba(14,141,131,.13)]'
            : 'border-ink-200 hover:border-ink-300',
        )}
      >
        <span className={cx('min-w-0 flex-1 truncate', selected ? 'text-ink-900' : 'text-ink-400')}>
          {selected ? selected.label : placeholder}
          {selected?.hint && <span className="text-ink-500"> · {selected.hint}</span>}
        </span>
        <ChevronDown size={16} strokeWidth={1.9}
          className={cx('shrink-0 text-ink-400 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {mounted && open && rect && createPortal(
        <div
          ref={popRef} dir="rtl"
          style={{
            position: 'fixed', top: rect.top, left: rect.left, width: rect.width,
            transform: rect.above ? 'translateY(calc(-100% - 6px))' : undefined,
          }}
          className="z-[90] overflow-hidden rounded-lg border border-ink-200 bg-paper shadow-pop"
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-ink-150 px-3">
              <Search size={15} className="shrink-0 text-ink-400" />
              <input
                ref={searchRef} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }}
                onKeyDown={onKey} placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent text-panel text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
          )}

          <ul id={listId} role="listbox" className="thin-scroll max-h-[15rem] overflow-y-auto py-1">
            {creatable && q.trim() && !options.some((o) => foldArabic(o.label) === foldArabic(q)) && (
              <li role="option" aria-selected={false}>
                <button type="button" onClick={() => commit(q.trim())}
                  className="flex w-full items-center gap-2 border-b border-ink-150 px-3 py-2 text-start text-panel text-brand-800 transition-colors hover:bg-brand-50">
                  <Plus size={14} strokeWidth={2.2} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{createLabel} «{q.trim()}»</span>
                </button>
              </li>
            )}
            {filtered.length === 0 && !(creatable && q.trim()) && (
              <li className="px-3 py-3 text-center text-panel text-ink-500">{emptyText}</li>
            )}
            {filtered.map((o, i) => {
              const isSel = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={isSel}>
                  <button
                    type="button" onClick={() => commit(o.value)} onMouseEnter={() => setActive(i)}
                    className={cx(
                      'flex w-full items-center gap-2 px-3 py-2 text-start text-panel transition-colors',
                      i === active ? 'bg-brand-50' : 'bg-transparent',
                      isSel ? 'font-medium text-brand-800' : 'text-ink-800',
                    )}
                  >
                    <span className="w-4 shrink-0">
                      {isSel && <Check size={14} strokeWidth={2.4} className="text-brand-700" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-micro text-ink-500">{o.hint}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}
