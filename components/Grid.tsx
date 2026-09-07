'use client';
/* A table of inputs that behaves like a spreadsheet, because that is what the
   supervisor has been filling in for years.

   Arrows move between cells; Enter goes down; ⌘D copies the cell above. The
   surah columns complete what he is typing and, on an empty cell, offer the
   two answers that are almost always right: the surah the row above ended on,
   and the one after it — a level runs through the mushaf in order, so «العنكبوت»
   is followed by «العنكبوت» or by «الروم» and hardly ever by anything else.

   Left and right move the CARET first and the cell only at the edge of the
   text. Jumping cells mid-word is the one thing that would make this worse
   than a plain form. */
import {
  createContext, useContext, useCallback, useEffect, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { matchSurahs, nextSurah, type Surah } from '@/lib/surahs';
import { cx } from '@/lib/cx';
import { INPUT } from '@/components/ui';

type Ctx = {
  register: (key: string, el: HTMLInputElement | null) => void;
  focus: (row: number, col: number) => void;
  rows: number; cols: number;
};
const GridCtx = createContext<Ctx | null>(null);

export function Grid({ rows, cols, children }: {
  rows: number; cols: number; children: React.ReactNode;
}) {
  const cells = useRef(new Map<string, HTMLInputElement>());

  const register = useCallback((key: string, el: HTMLInputElement | null) => {
    if (el) cells.current.set(key, el); else cells.current.delete(key);
  }, []);

  const focus = useCallback((row: number, col: number) => {
    const el = cells.current.get(`${row}:${col}`);
    if (!el) return;
    el.focus();
    /* Landing with the text selected is what makes typing over a cell work the
       way it does in a spreadsheet. */
    el.select();
  }, []);

  return (
    <GridCtx.Provider value={{ register, focus, rows, cols }}>{children}</GridCtx.Provider>
  );
}

export function GridCell({
  row, col, value, onChange, kind = 'text', fillDown, placeholder, className, ariaLabel,
}: {
  row: number; col: number;
  value: string;
  onChange: (v: string) => void;
  /** `surah` turns on completion and the what-comes-next offer. */
  kind?: 'text' | 'surah' | 'ayah';
  /** The value of the same column one row up — ⌘D copies it, and the surah
      offer is built from it. Undefined on the first row. */
  fillDown?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const grid = useContext(GridCtx);
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    grid?.register(`${row}:${col}`, ref.current);
    return () => grid?.register(`${row}:${col}`, null);
  }, [grid, row, col]);

  /* What to offer. A part-typed name completes; an empty cell gets the two
     that follow from the row above. */
  const options: Surah[] = (() => {
    if (kind !== 'surah') return [];
    if (value.trim()) return matchSurahs(value);
    const prev = fillDown?.trim();
    if (!prev) return [];
    const same = matchSurahs(prev, 1);
    const next = nextSurah(prev);
    return [...same, ...(next ? [next] : [])];
  })();

  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setBox({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 150) });
  };

  const show = () => { if (kind === 'surah') { place(); setOpen(true); setActive(0); } };
  const take = (s: Surah) => { onChange(s.name); setOpen(false); ref.current?.focus(); };

  const move = (dr: number, dc: number) => {
    if (!grid) return;
    let r = row + dr, c = col + dc;
    /* Walking off the end of a row continues on the next one, the way Tab does
       in a spreadsheet — it is one long list of cells, not a set of islands. */
    if (c < 0) { c = grid.cols - 1; r -= 1; }
    if (c >= grid.cols) { c = 0; r += 1; }
    if (r < 0 || r >= grid.rows) return;
    grid.focus(r, c);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (fillDown !== undefined) onChange(fillDown);
      return;
    }

    if (open && options.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault(); take(options[active]);
        if (e.key === 'Tab') move(0, 1);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    }

    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1, 0); break;
      case 'ArrowUp':   e.preventDefault(); move(-1, 0); break;
      case 'Enter':     e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); break;
      /* RTL: the next column is drawn to the LEFT, so ArrowLeft advances. */
      case 'ArrowLeft':  if (atEnd)   { e.preventDefault(); move(0, 1); } break;
      case 'ArrowRight': if (atStart) { e.preventDefault(); move(0, -1); } break;
      default: break;
    }
  };

  return (
    <>
      <input
        ref={ref}
        data-cell={`${row}:${col}`}
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        inputMode={kind === 'ayah' ? 'numeric' : undefined}
        autoComplete="off"
        className={cx(INPUT, 'h-8 px-2 text-panel', className)}
        onChange={(e) => { onChange(e.target.value); show(); }}
        onFocus={show}
        onClick={place}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {open && options.length > 0 && box && typeof document !== 'undefined' && createPortal(
        <ul role="listbox"
          style={{ position: 'fixed', top: box.top, left: box.left, width: box.width, zIndex: 80 }}
          className="fade overflow-hidden rounded-lg border border-ink-200 bg-paper py-1 shadow-pop">
          {options.map((s, i) => (
            <li key={s.n}>
              <button type="button" tabIndex={-1}
                onMouseDown={(e) => { e.preventDefault(); take(s); }}
                onMouseEnter={() => setActive(i)}
                className={cx('flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-start text-panel transition-colors',
                  i === active ? 'bg-brand-50 text-brand-900' : 'text-ink-700 hover:bg-ink-100')}>
                <span>{s.name}</span>
                <span className="text-micro text-ink-400">{s.ayahs} آية</span>
              </button>
            </li>
          ))}
        </ul>, document.body)}
    </>
  );
}
