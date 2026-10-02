'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   الجولة — «شرح للخاصية الجديدة خطوة بخطوة» (client, 2 Oct 2026).

   The room dims and one thing on the page is lit, with a card beside it saying
   what it is; «التالي» slides the light to the next. The light is a hole in the
   dimmer, not a wall: the page underneath stays clickable, because some steps
   only exist once he has done something — the level grid appears after a
   student is picked. Such a step waits, says what to do (`waitHint`), and
   moves on by itself the moment its element appears.

   Started by «ورّني كيف» in «ما الجديد», which records the tour in
   sessionStorage and navigates; this component, mounted in each portal's
   layout, picks it up on the new page. A target missing from the page (a panel
   that is closed, a phone layout) centres the card instead of pointing at
   nothing.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';
import { RELEASES } from '@/content/releases';

const KEY = 'halqah_tour';
const START = 'halqah:tour-start';
/** Fired when a tour ends, so «ما الجديد» can open whatever is still queued. */
export const TOUR_END = 'halqah:tour-end';

export function startTour(releaseId: string) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ id: releaseId, step: 0 })); } catch { /* */ }
  window.dispatchEvent(new Event(START));
}

const read = (): { id: string; step: number } | null => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return null; }
};

type Box = { top: number; left: number; width: number; height: number };

const find = (target: string): HTMLElement | null => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
};

const PAD = 8;
const TIP_W = 340;

export function Tour({ onNeedPanel }: {
  /** Opens the contextual panel, for steps that point into it (`nav-…`). */
  onNeedPanel?: () => void;
}) {
  const path = usePathname();
  const [state, setState] = useState<{ id: string; step: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [nextReady, setNextReady] = useState(true);
  const [tipH, setTipH] = useState(220);
  const tipRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef('');

  /* Pick the tour up on arrival, and when «ورّني كيف» starts one. */
  useEffect(() => { setState(read()); }, [path]);
  useEffect(() => {
    const on = () => setState(read());
    window.addEventListener(START, on);
    return () => window.removeEventListener(START, on);
  }, []);

  const release = state ? RELEASES.find((r) => r.id === state.id) : null;
  const steps = release?.tour?.steps ?? [];
  const onPage = !!release?.tour && path.startsWith(release.tour.href);
  const step = state && onPage ? steps[state.step] : undefined;
  const nextStep = state ? steps[state.step + 1] : undefined;

  const go = (n: number) => {
    if (!state) return;
    const s = { ...state, step: n };
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ }
    setState(s);
  };

  const end = () => {
    try { sessionStorage.removeItem(KEY); } catch { /* */ }
    setState(null); setBox(null);
    window.dispatchEvent(new Event(TOUR_END));
  };

  /* Follow the target every frame: the page scrolls inside `main`, panels open,
     a list grows above it — measuring once would leave the light behind. */
  useEffect(() => {
    if (!step) return;
    if (step.target.startsWith('nav-')) onNeedPanel?.();
    let raf = 0;
    const tick = () => {
      const el = find(step.target);
      if (el) {
        if (scrolledFor.current !== `${state?.id}:${state?.step}`) {
          scrolledFor.current = `${state?.id}:${state?.step}`;
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        const r = el.getBoundingClientRect();
        setBox((b) => (b && Math.abs(b.top - r.top) < .5 && Math.abs(b.left - r.left) < .5
          && Math.abs(b.width - r.width) < .5 && Math.abs(b.height - r.height) < .5
          ? b : { top: r.top, left: r.left, width: r.width, height: r.height }));
      } else {
        setBox(null);
      }
      setNextReady(!nextStep || !!find(nextStep.target));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, nextStep, state, onNeedPanel]);

  /* A step that was waiting moves on by itself the moment its next appears. */
  const wasWaiting = useRef(false);
  useEffect(() => {
    if (!step) return;
    if (!nextReady) { wasWaiting.current = true; return; }
    if (wasWaiting.current && state) { wasWaiting.current = false; go(state.step + 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextReady]);

  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight);
  });

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') end(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!step || !state || !release) return null;

  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(TIP_W, vw - 32);
  const hole = box && {
    top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 };

  /* The card goes below the light when it fits, above when it does not, and
     centred when there is no light at all. */
  let tip: { top: number; left: number };
  if (hole) {
    const below = hole.top + hole.height + 14;
    const above = hole.top - 14 - tipH;
    const top = below + tipH <= vh - 12 ? below : above >= 12 ? above : Math.max(12, vh - tipH - 12);
    const center = hole.left + hole.width / 2 - w / 2;
    tip = { top, left: Math.min(Math.max(16, center), vw - w - 16) };
  } else {
    tip = { top: Math.max(16, vh / 2 - tipH / 2), left: vw / 2 - w / 2 };
  }

  const last = state.step === steps.length - 1;
  const waiting = !nextReady && !!step.waitHint;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[95]" aria-live="polite">
      {hole ? (
        <div className="tour-hole absolute rounded-[14px] ring-2 ring-[#D9BE83]"
          style={{ ...hole, boxShadow: '0 0 0 9999px rgba(5,31,29,.62), 0 0 0 6px rgba(217,190,131,.18), 0 0 40px 4px rgba(217,190,131,.35)' }}>
          <span className="absolute -inset-1 animate-[ringPulse_2s_ease-out_infinite] rounded-[16px] border-2 border-[#D9BE83]/70" />
        </div>
      ) : (
        <div className="fade absolute inset-0 bg-[#051f1d]/60" />
      )}

      <div ref={tipRef} role="dialog" aria-label={step.title}
        className="tour-tip pointer-events-auto absolute overflow-hidden rounded-2xl bg-paper shadow-[0_30px_70px_-20px_rgba(0,0,0,.55),0_0_0_1px_rgba(25,30,28,.06)]"
        style={{ top: tip.top, left: tip.left, width: w }}>
        <div className="h-1 bg-ink-100">
          <div className="h-full bg-gradient-to-l from-[#C9A766] to-[#E5CF9C] transition-[width] duration-500 ease-brand"
            style={{ width: `${((state.step + 1) / steps.length) * 100}%` }} />
        </div>
        <div key={state.step} className="mark-in px-5 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-micro text-ink-500">
              الخطوة <Num>{state.step + 1}</Num> من <Num>{steps.length}</Num>
            </span>
            <button type="button" onClick={end} aria-label="إنهاء الجولة"
              className="grid h-7 w-7 place-items-center rounded-full text-ink-400 transition-colors hover:bg-page hover:text-ink-800">
              <X size={15} />
            </button>
          </div>
          <h3 className="mt-1.5 font-display text-xl2 text-ink-900">{step.title}</h3>
          <p className="mt-1.5 text-body leading-relaxed text-ink-600">{step.body}</p>

          {waiting && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-[#D9BE83]/50 bg-[#F6EFDD] px-3 py-2 text-panel leading-relaxed text-[#6B5220]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#B38F4A]" />
              {step.waitHint}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button type="button" disabled={!last && !nextReady}
              onClick={() => (last ? end() : go(state.step + 1))}
              className={cx('press inline-flex h-10 items-center gap-1 rounded-lg px-4 text-body font-medium transition-colors',
                'bg-brand-900 text-white hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-45')}>
              {last ? 'فهمت' : <>التالي <ChevronLeft size={16} /></>}
            </button>
            {state.step > 0 && (
              <button type="button" onClick={() => go(state.step - 1)} aria-label="السابق"
                className="grid h-10 w-10 place-items-center rounded-lg border border-ink-200 text-ink-600 transition-colors hover:bg-page">
                <ChevronRight size={16} />
              </button>
            )}
            {!last && (
              <button type="button" onClick={end}
                className="ms-auto text-panel text-ink-500 hover:text-ink-800">إنهاء الجولة</button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
