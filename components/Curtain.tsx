'use client';
/* The curtain: a full-bleed panel in the page colour with the mark centred,
   which lifts straight up and off the viewport. Whatever it covers is already
   rendered underneath — the reveal is genuine, not a fade-in. */
import { LogoFull } from '@/components/Logo';
import { LIFT_EASE } from '@/lib/motion';
import { cx } from '@/lib/cx';

export function Curtain({ up, markVisible, fadeIn, lift, height = 104 }:
  { up: boolean; markVisible: boolean; fadeIn: number; lift: number; height?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-page"
      style={{
        transform: up ? 'translateY(-100%)' : 'translateY(0)',
        transition: `transform ${lift}ms ${LIFT_EASE}`,
        willChange: 'transform',
      }}
    >
      <div
        className={cx('flex flex-col items-center')}
        style={{
          opacity: markVisible ? 1 : 0,
          transform: markVisible ? 'none' : 'scale(.97)',
          transition: `opacity ${fadeIn}ms ease, transform ${fadeIn}ms cubic-bezier(.22,.61,.36,1)`,
        }}
      >
        <LogoFull height={height} />
      </div>
    </div>
  );
}
