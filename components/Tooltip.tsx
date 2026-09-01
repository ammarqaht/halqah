'use client';
/* A small panel that appears beside what you point at — used where a table cell
   holds more than it can show, so the detail stays available without spending a
   column on it (DESIGN.md §3: the roster's rule that a column identical on
   every row carries nothing).

   Two things it has to get right:
   - **Portalled.** Table bodies scroll inside `overflow-x-auto`, and an
     absolutely-positioned child would be clipped by that box. Positioning is
     measured against the viewport instead, the same technique the Combobox uses.
   - **Keyboard, not only mouse.** DESIGN.md §9 requires every affordance to be
     reachable without a pointer, so the trigger is focusable and the panel is
     tied to it with `aria-describedby`. Hover alone would hide the detail from
     anyone who does not use a mouse. */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';

export function Tooltip({ content, children, className }: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      /* Flip above when there is no room below, so the panel never sits
         half-off the bottom of a long table. */
      const above = window.innerHeight - r.bottom < 140;
      setBox({ top: above ? r.top - 8 : r.bottom + 8, left: r.left + r.width / 2, above });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  /* Escape closes it — the same key that dismisses every other transient
     surface in the product. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={cx('cursor-help decoration-ink-300 decoration-dotted underline-offset-4',
          'hover:decoration-brand-400 focus:outline-none focus-visible:underline', className)}
      >
        {children}
      </span>

      {mounted && open && box && createPortal(
        <div
          id={id} role="tooltip" dir="rtl"
          style={{
            position: 'fixed', top: box.top, left: box.left,
            transform: `translateX(-50%)${box.above ? ' translateY(-100%)' : ''}`,
          }}
          className="pointer-events-none z-[95] max-w-[18rem] rounded-lg border border-ink-200 bg-paper px-3 py-2 text-panel text-ink-800 shadow-pop"
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
