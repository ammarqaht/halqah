'use client';
/* خمسة مربّعات، لا خانة واحدة.
   A boy reading five digits off a paper slip loses his place in a single
   field. One box per digit shows him exactly how far he has got, and the caret
   moves itself — he never has to aim at anything.

   One real <input> per box, because a hidden field with painted boxes over it
   breaks the password manager, the iOS SMS autofill and the accessibility
   tree. These are inputs; they just behave as one. */
import { useEffect, useRef } from 'react';
import { cx } from '@/lib/cx';

export function PinInput({ value, onChange, length = 5, autoFocus, onComplete, label }: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
  /** Fired the moment the last digit lands — a boy should not hunt for a button. */
  onComplete?: (v: string) => void;
  label: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  const set = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  const put = (i: number, raw: string) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;
    /* Pasting the whole PIN into any box fills them all — which is what a
       supervisor reading it aloud, or a boy long-pressing, actually does. */
    if (typed.length > 1) {
      set((value.slice(0, i) + typed).slice(0, length));
      refs.current[Math.min(length - 1, i + typed.length)]?.focus();
      return;
    }
    const next = (value.padEnd(length, ' ').substring(0, i) + typed
      + value.padEnd(length, ' ').substring(i + 1)).replace(/ /g, '').slice(0, length);
    set(next);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const key = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      /* Backspace on an empty box steps back and clears — the behaviour every
         one-time-code field has, and the one a thumb expects. */
      const at = value[i] ? i : Math.max(0, i - 1);
      set(value.slice(0, at) + value.slice(at + 1));
      refs.current[at]?.focus();
      return;
    }
    /* RTL: the next box is drawn to the LEFT, so ArrowLeft advances. */
    if (e.key === 'ArrowLeft') { e.preventDefault(); refs.current[Math.min(length - 1, i + 1)]?.focus(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); refs.current[Math.max(0, i - 1)]?.focus(); }
  };

  return (
    <div dir="ltr" className="flex justify-center gap-2.5" role="group" aria-label={label}>
      {digits.map((d, i) => {
        const filled = d.trim() !== '';
        return (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={filled ? d : ''}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => key(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="numeric"
            /* `one-time-code` is what puts the digits above an iOS keyboard. */
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`${label} — الخانة ${i + 1}`}
            maxLength={1}
            className={cx(
              'h-[58px] w-[52px] rounded-xl border-2 bg-paper text-center',
              'font-display text-t1 text-ink-900 caret-brand-700',
              'transition-[border-color,box-shadow,transform] duration-150 ease-brand',
              'focus:border-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-700/12',
              filled ? 'border-brand-700 bg-brand-50' : 'border-ink-200',
            )}
          />
        );
      })}
    </div>
  );
}
