'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import type { LucideIcon } from 'lucide-react';

const BTN = {
  primary: 'bg-brand-800 text-white hover:bg-brand-900 active:bg-brand-900 shadow-card',
  default: 'bg-paper text-ink-800 border border-ink-200 hover:bg-ink-100 hover:border-ink-300',
  ghost:   'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  quiet:   'bg-brand-50 text-brand-800 border border-brand-200 hover:bg-brand-100',
  /* Destructive, and it has to LOOK destructive without shouting: an outlined
     risk button beside a quiet default reads as the heavier of the two. Tinting
     a `default` button with a className cannot do this — two utilities of equal
     specificity resolve by stylesheet order, not by the order they were
     written, so the colour that wins is whichever Tailwind emitted last. */
  danger:  'bg-risk-100 text-risk-700 border border-risk-200 hover:bg-risk-200',
} as const;
const SIZE = {
  sm: 'h-8 px-3 text-cap gap-1.5', md: 'h-9 px-3.5 text-body gap-2',
  lg: 'h-11 px-5 text-base2 gap-2', xl: 'h-12 px-6 text-base2 gap-2.5',
} as const;

export function Btn({ children, variant = 'default', size = 'md', icon: Ico, className, ...rest }:
  { children?: React.ReactNode; variant?: keyof typeof BTN; size?: keyof typeof SIZE; icon?: LucideIcon }
  & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cx('inline-flex items-center justify-center rounded-md font-medium',
      'transition-[background-color,border-color,transform] duration-150 ease-brand',
      'active:scale-[.985] disabled:pointer-events-none disabled:opacity-55',
      BTN[variant], SIZE[size], className)}>
      {Ico && <Ico size={size === 'sm' ? 15 : 17} strokeWidth={1.9} />}
      {children}
    </button>
  );
}

/**
 * The field's LOOK, with no size of its own.
 *
 * `INPUT` below is this plus `h-11 w-full`, which is right for a form. It is
 * wrong for the narrow numeric boxes in the settings tables, and wrong in a way
 * that cannot be fixed by appending a class: `cx(INPUT, 'w-20')` puts two
 * utilities of EQUAL specificity on one element, and which of them wins is
 * decided by the order Tailwind emitted them in — not by the order they were
 * written. That is the same trap `BTN.danger` above is documented for, and it is
 * why the مقرّر boxes rendered five hundred pixels wide.
 *
 * So anything that wants its own width composes `INPUT_BARE` and states both.
 */
export const INPUT_BARE =
  'rounded-md border border-ink-200 bg-paper px-3.5 text-base2 text-ink-900 ' +
  'placeholder:text-ink-400 transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-ink-300 focus:border-brand-700 focus:shadow-[0_0_0_3px_rgba(14,141,131,.13)] focus:outline-none';

export const INPUT = `h-11 w-full ${INPUT_BARE}`;

export function Field({ label, hint, htmlFor, children }:
  { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-xs2 font-medium text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-micro text-ink-500">{hint}</span>}
    </label>
  );
}

export function Empty({ title, body, action, icon: Ico }:
  { title: string; body?: string; action?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Ico && (
        <span className="mb-5 rounded-2xl bg-ink-100 p-4 text-ink-400">
          <Ico size={26} strokeWidth={1.6} />
        </span>
      )}
      <p className="font-display text-t1 text-ink-900">{title}</p>
      {body && <p className="mt-2 max-w-sm text-base2 text-ink-600">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** How far down it must be pulled before letting go dismisses it. */
const DISMISS_PX = 120;
/** ...or how fast: a short, quick flick is a dismissal too. */
const DISMISS_VELOCITY = 0.65;
/** Matches `.sheet-leave`'s transition, so it is unmounted after it has left. */
const CLOSE_MS = 240;

type Phase = 'in' | 'rest' | 'drag' | 'settle' | 'leave';

const PHASE: Record<Phase, string> = {
  in: 'sheet-in', rest: 'sheet-rest', drag: 'sheet-drag',
  settle: 'sheet-settle', leave: 'sheet-leave',
};

/* Rendered into <body>. A `position: fixed` box is positioned against its
   nearest transformed ancestor, not the viewport — and an ancestor keeps a
   transform after any `transform` animation with fill-mode `both`. Portalling
   makes the dialog immune to whatever wrapper it is invoked from.

   THE SHEET RISES, FALLS, AND CAN BE PUSHED AWAY BY HAND — «النوافذ تكون سلسة
   تطلع من تحت وتنزل من فوق، وتكون قابلة للسحب» (client, 18 Sep 2026). It used
   to appear with `rise` and then simply cease to exist: no exit at all, which
   on a phone reads as the screen blinking rather than as something being put
   down.

   FIVE PHASES, and only arrival is a keyframe. Arrival starts from a known
   place; everything after it starts from wherever the thumb left the sheet,
   which no keyframe can know. So the drag writes `--sheet-y` with the animation
   off, and settling back and leaving are TRANSITIONS of that same property — a
   sheet flicked halfway down carries on from halfway rather than snapping back
   to be animated away. `rest` is the quiet state between them, and it exists so
   that returning from a drag never replays the arrival under the reader's thumb.

   Everything that closes it — the ✕, the backdrop, Escape, the drag — goes
   through one `close()`, so it is never yanked out of the page without falling.

   The grip is the HEADER rather than a hairline pill on its own: a thumb reaches
   for the title bar, and the body below it has its own scroll that a drag must
   not steal. */
export function Modal({ open, onClose, title, children, footer, wide }:
  { open: boolean; onClose: () => void; title: string;
    children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('in');
  /** How far the sheet is offset, in pixels. Zero when it is where it belongs. */
  const [y, setY] = useState(0);
  const sheet = useRef<HTMLDivElement>(null);
  const from = useRef<{ y: number; t: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    if (timer.current) return;
    /* It leaves from where it is: `--sheet-y` goes to the sheet's own height, and
       `.sheet-leave` transitions to it — from zero for a tap on the ✕, and from
       wherever the thumb had pushed it for a flick. */
    setY(sheet.current?.offsetHeight ?? 640);
    setPhase('leave');
    from.current = null;
    timer.current = setTimeout(() => {
      timer.current = null;
      onClose();
    }, CLOSE_MS);
  }, [onClose]);

  /* A sheet reopened while its own exit was still running would come back
     already leaving. */
  useEffect(() => {
    if (!open) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setPhase('in'); setY(0); from.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, close]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const grab = (e: React.PointerEvent) => {
    /* The ✕ is inside the grip and must stay a button. */
    if ((e.target as HTMLElement).closest('button')) return;
    if (phase === 'leave') return;
    from.current = { y: e.clientY, t: performance.now() };
    setPhase('drag'); setY(0);
    /* Capture so the sheet keeps following a thumb that slides off its header —
       and `try`, because a pointer that has already been released throws here
       rather than returning false, and losing the capture is not a reason to
       lose the drag. */
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* it follows the page's pointer instead */ }
  };

  const move = (e: React.PointerEvent) => {
    if (!from.current) return;
    /* Downward only. A sheet dragged UP would leave a gap under it, and there
       is nothing above it to reveal. */
    setY(Math.max(0, e.clientY - from.current.y));
  };

  const release = (e: React.PointerEvent) => {
    if (!from.current) return;
    const dy = Math.max(0, e.clientY - from.current.y);
    const speed = dy / Math.max(1, performance.now() - from.current.t);
    from.current = null;
    if (dy > DISMISS_PX || speed > DISMISS_VELOCITY) { close(); return; }
    /* Not far enough: it slides back to where it belongs and rests there. */
    setPhase('settle'); setY(0);
  };

  if (!open || !mounted) return null;

  /* The ground lightens as the sheet is pulled away, so the gesture shows its
     own outcome before the thumb is lifted. */
  const veil = phase === 'drag' ? Math.max(0, 1 - y / 420) : phase === 'leave' ? 0 : 1;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div onClick={close} style={{ opacity: veil }}
        className={cx('absolute inset-0 bg-brand-900/30 backdrop-blur-[2px] transition-opacity duration-200',
          phase === 'in' && 'fade')} />
      <div ref={sheet} role="dialog" aria-modal="true" aria-label={title}
        style={{ ['--sheet-y' as string]: `${y}px` }}
        onAnimationEnd={() => { if (phase === 'in') setPhase('rest'); }}
        onTransitionEnd={() => { if (phase === 'settle') setPhase('rest'); }}
        className={cx('relative m-0 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-paper shadow-pop sm:m-6 sm:rounded-2xl',
          PHASE[phase], wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <header onPointerDown={grab} onPointerMove={move}
          onPointerUp={release} onPointerCancel={release}
          className="sheet-grip relative flex shrink-0 items-center justify-between gap-4 border-b border-ink-150 px-5 pb-4 pt-5 sm:py-4">
          {/* اسحبني — a phone's affordance, and only where the gesture is the
              natural way out. A mouse has the ✕ and the backdrop. */}
          <span aria-hidden
            className="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-ink-200 sm:hidden" />
          <h2 className="text-lg2 font-bold text-ink-900">{title}</h2>
          <button onClick={close} aria-label="إغلاق"
            className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800">✕</button>
        </header>
        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-ink-150 bg-page/60 px-5 py-3.5">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Chip({ children, tone = 'ink' }:
  { children: React.ReactNode; tone?: 'ink' | 'brand' | 'ok' | 'warn' | 'risk' | 'info' | 'assoc' }) {
  const t = {
    ink: 'bg-ink-100 text-ink-700', brand: 'bg-brand-100 text-brand-800',
    ok: 'bg-ok-100 text-ok-700', warn: 'bg-warn-100 text-warn-700',
    risk: 'bg-risk-100 text-risk-700', info: 'bg-info-100 text-info-700',
    assoc: 'bg-assoc-100 text-assoc-900',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium', t)}>{children}</span>;
}

/* Two or three views of the same data, switched in place. Tabs would imply
   separate destinations; these are one screen looked at two ways, so the
   control stays inline with the content it changes. DESIGN.md §7. */
export function Segmented<T extends string>({ value, onChange, options }:
  { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-ink-200 bg-paper p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className={cx('rounded-md px-3.5 py-1.5 text-cap font-medium transition-colors duration-150',
              on ? 'bg-brand-800 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900')}>
            {o.label}
            {o.count != null && (
              <span className={cx('ms-1.5 text-2xs', on ? 'text-white/70' : 'text-ink-400')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
