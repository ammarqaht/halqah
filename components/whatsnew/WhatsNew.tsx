'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   ما الجديد — the announcement, in front of him the moment he arrives.

   «ابي شكل صفحة التحديثات الي تطلع بوجهه فخمة مثل حقت الاعلانات وافخم»
   (client, 2 Oct 2026). So it is a launch card, not a toast: the words on the
   paper side, a drawing of the idea on the deep green side (the only deep field
   in the product, as on the sign-in pages), and the whole thing arriving out of
   a soft focus.

   Everything unseen for this portal opens here, oldest first — a supervisor
   back after three weeks reads the three updates in the order they happened,
   with «1 من 3» and a bar across the top. Leaving a card is reading it.
   «ورّني كيف» hands over to the tour (./Tour) on the page itself; whatever is
   left in the queue opens again when the tour ends.

   Seen-ness is kept on the server per person (api/releases) and mirrored in
   this browser, so a failed write does not bring the same card back next load.
   ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, PlayCircle, Sparkles, X } from 'lucide-react';
import { Lattice } from '@/components/Lattice';
import { LogoFull } from '@/components/Logo';
import { Num } from '@/components/Num';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';
import {
  AUDIENCE_AR, releasesFor, type Audience, type Release,
} from '@/content/releases';
import { ReleaseVisual } from './visuals';
import { startTour, TOUR_END } from './Tour';

/** Fire this to open every update for the portal, seen or not. */
export const OPEN_WHATSNEW = 'halqah:whatsnew';

const localKey = (a: Audience) => `halqah_seen_releases_${a}`;
const readLocal = (a: Audience): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(localKey(a)) ?? '[]')); }
  catch { return new Set(); }
};
const writeLocal = (a: Audience, ids: Set<string>) => {
  try { localStorage.setItem(localKey(a), JSON.stringify([...ids])); } catch { /* private mode */ }
};

/** The unseen updates for this person, and a way to mark them read. */
function useUnseen(audience: Audience) {
  const [unseen, setUnseen] = useState<Release[] | null>(null);

  const load = useCallback(async () => {
    const local = readLocal(audience);
    let seen = new Set<string>();
    let since: string | null = null;
    try {
      const r = await fetch(`/api/releases?for=${audience}`, { cache: 'no-store' });
      if (!r.ok) { setUnseen([]); return; }
      const j = await r.json();
      seen = new Set(j.seen ?? []);
      since = j.since ?? null;
    } catch { /* offline: the browser's own memory is all there is */ }
    setUnseen(releasesFor(audience)
      .filter((x) => !seen.has(x.id) && !local.has(x.id) && (!since || x.date >= since))
      .sort((a, b) => (a.date < b.date ? -1 : 1)));
  }, [audience]);

  useEffect(() => { void load(); }, [load]);

  const markSeen = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const local = readLocal(audience);
    ids.forEach((id) => local.add(id));
    writeLocal(audience, local);
    fetch('/api/releases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ for: audience, ids }),
    }).catch(() => { /* the local copy holds until the next load */ });
  }, [audience]);

  return { unseen, markSeen, reload: load };
}

export function WhatsNew({ audience }: { audience: Audience }) {
  const router = useRouter();
  const { unseen, markSeen, reload } = useUnseen(audience);
  const [queue, setQueue] = useState<Release[] | null>(null);
  const [archive, setArchive] = useState(false);
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const shownFor = useRef<string>('');

  useEffect(() => setMounted(true), []);

  /* Open once per distinct unseen set — not again on every re-render. */
  useEffect(() => {
    if (!unseen?.length) return;
    const sig = unseen.map((r) => r.id).join('|');
    if (sig === shownFor.current) return;
    shownFor.current = sig;
    setArchive(false); setI(0); setQueue(unseen);
  }, [unseen]);

  /* «ما الجديد» on demand — every update for this portal, newest first. */
  useEffect(() => {
    const open = () => {
      const all = [...releasesFor(audience)].sort((a, b) => (a.date < b.date ? 1 : -1));
      if (!all.length) return;
      setArchive(true); setI(0); setQueue(all);
    };
    const resume = () => { void reload(); };
    window.addEventListener(OPEN_WHATSNEW, open);
    window.addEventListener(TOUR_END, resume);
    return () => {
      window.removeEventListener(OPEN_WHATSNEW, open);
      window.removeEventListener(TOUR_END, resume);
    };
  }, [audience, reload]);

  const isOpen = !!queue && i < queue.length;

  /* Focus the main button WITHOUT scrolling to it — `autoFocus` scrolled a
     phone straight past the picture to the bottom of the card. */
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => document.querySelector<HTMLElement>('[data-wn-primary]')
      ?.focus({ preventScroll: true }), 50);
    return () => clearTimeout(t);
  }, [isOpen, i]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => { setQueue(null); setLeaving(false); setI(0); }, 300);
  }, []);

  const seen = useCallback((ids: string[]) => { if (!archive) markSeen(ids); }, [archive, markSeen]);

  const next = useCallback(() => {
    if (!queue) return;
    seen([queue[i].id]);
    if (i + 1 >= queue.length) close(); else setI(i + 1);
  }, [queue, i, seen, close]);

  const prev = useCallback(() => { if (i > 0) setI(i - 1); }, [i]);

  const skipAll = () => { if (queue) seen(queue.slice(i).map((r) => r.id)); close(); };
  /* ✕ reads the card on screen; the ones after it wait for next time. */
  const dismiss = () => { if (queue) seen([queue[i].id]); close(); };

  const tour = (r: Release) => {
    seen([r.id]);
    setQueue(null); setI(0);
    startTour(r.id);
    router.push(r.tour!.href);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      /* RTL: the arrow pointing left is «forward». */
      if (e.key === 'ArrowLeft') next();
      if (e.key === 'ArrowRight') prev();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!mounted || !isOpen || !queue) return null;
  const r = queue[i];
  const last = i === queue.length - 1;
  const who = AUDIENCE_AR[audience];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="wn-title"
      className={cx('fixed inset-0 z-[90] overflow-y-auto',
        leaving ? 'opacity-0 transition-opacity duration-300' : 'fade')}>
      {/* the room dims, and a little gold light gathers behind the card */}
      <div className="fixed inset-0 bg-[#051f1d]/75 backdrop-blur-md" onClick={dismiss} />
      <div aria-hidden className="pointer-events-none fixed left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D9BE83]/10 blur-[110px]" />

      {/* min-h-full + centring, not centring the scroller: a card taller than
          a phone must scroll from its top, not be clipped above it. */}
      <div className="relative grid min-h-full place-items-center p-4 sm:p-6">
      <div key={r.id} className={cx('relative grid w-full max-w-[60rem] overflow-hidden rounded-[28px] bg-paper',
        'shadow-[0_50px_120px_-30px_rgba(0,0,0,.65),0_0_0_1px_rgba(255,255,255,.08)]',
        'md:grid-cols-[1.08fr_1fr]', leaving ? 'wn-out' : 'wn-in')}>

        {/* ── the words — first in the DOM, so on the RIGHT in RTL ─────── */}
        <div className="relative flex flex-col px-6 pb-6 pt-5 sm:px-9 sm:pb-8 sm:pt-7">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D9BE83]/60 bg-[#F6EFDD] px-3 py-1 text-micro font-medium tracking-[.1em] text-[#7A5D24]">
              <Sparkles size={13} strokeWidth={2} />
              {archive ? 'كل التحديثات' : 'ما الجديد'}
            </span>
            <div className="flex items-center gap-3">
              {queue.length > 1 && (
                <span className="text-micro text-ink-500">
                  <Num>{i + 1}</Num> من <Num>{queue.length}</Num>
                </span>
              )}
              <button type="button" onClick={dismiss} aria-label="إغلاق"
                className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 text-ink-500 transition-colors hover:bg-page hover:text-ink-800">
                <X size={16} />
              </button>
            </div>
          </div>

          {queue.length > 1 && (
            <div className="mt-4 flex gap-1.5" aria-hidden>
              {queue.map((q, n) => (
                <span key={q.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-ink-150">
                  <span className={cx('block h-full rounded-full bg-gradient-to-l from-[#C9A766] to-[#E5CF9C] transition-[width] duration-700 ease-brand',
                    n <= i ? 'w-full' : 'w-0')} />
                </span>
              ))}
            </div>
          )}

          <p className="wn-line mt-6 flex items-center gap-2 text-xs2 text-ink-500" style={{ animationDelay: '.15s' }}>
            <who.icon size={14} className="text-brand-700" />
            {who.label} · <Num>{formatDate(r.date)}</Num>
          </p>
          <h2 id="wn-title" className="wn-line mt-2 [text-wrap:balance] font-display text-t1 leading-snug text-ink-900 sm:text-d2 sm:leading-[1.25]"
            style={{ animationDelay: '.22s' }}>
            {r.title}
          </h2>
          <p className="wn-line mt-3 text-base2 leading-relaxed text-ink-600" style={{ animationDelay: '.3s' }}>
            {r.summary}
          </p>

          <ul className="mt-6 space-y-3.5">
            {r.points.map((p, n) => (
              <li key={p.title} className="wn-line flex items-start gap-3.5"
                style={{ animationDelay: `${0.42 + n * 0.09}s` }}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-800 ring-1 ring-brand-200">
                  <p.icon size={18} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-base2 font-medium text-ink-900">{p.title}</span>
                  <span className="block text-panel leading-relaxed text-ink-600">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="wn-line mt-auto flex flex-wrap items-center gap-2.5 pt-8" style={{ animationDelay: '.7s' }}>
            {r.tour && (
              <button type="button" onClick={() => tour(r)} data-wn-primary
                className="press relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-xl bg-brand-900 px-5 text-base2 font-medium text-white shadow-[0_12px_28px_-12px_rgba(10,64,60,.9)] transition-colors hover:bg-brand-800">
                <span aria-hidden className="wn-sheen pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-white/30 to-transparent" />
                <PlayCircle size={18} strokeWidth={1.9} className="text-[#E7D3A5]" />
                ورّني كيف
              </button>
            )}
            <button type="button" onClick={next} data-wn-primary={r.tour ? undefined : true}
              className={cx('press inline-flex h-12 items-center gap-1.5 rounded-xl px-5 text-base2 font-medium transition-colors',
                r.tour ? 'border border-ink-200 bg-paper text-ink-800 hover:bg-page'
                  : 'bg-brand-900 text-white hover:bg-brand-800')}>
              {last ? 'تمّ' : <>التالي <ChevronLeft size={18} /></>}
            </button>
            {i > 0 && (
              <button type="button" onClick={prev} aria-label="السابق"
                className="grid h-12 w-12 place-items-center rounded-xl border border-ink-200 text-ink-600 transition-colors hover:bg-page">
                <ChevronRight size={18} />
              </button>
            )}
            {!last && !archive && (
              <button type="button" onClick={skipAll}
                className="ms-auto text-panel text-ink-500 underline-offset-4 hover:text-ink-800 hover:underline">
                تخطَّ الكل
              </button>
            )}
          </div>
        </div>

        {/* ── the picture — on the LEFT in RTL, on top on a phone ──────── */}
        <div className="relative order-first min-h-[17.5rem] overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-[#062b28] md:order-none md:min-h-[34rem]">
          <Lattice className="pointer-events-none absolute inset-0 h-full w-full text-white" opacity={0.07} />
          <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full bg-[#D9BE83]/[.12] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -start-20 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />

          <div className="absolute inset-x-6 top-5 flex items-center justify-between">
            <LogoFull height={30} white />
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-2xs tracking-[.14em] text-white/60">
              تحديث
            </span>
          </div>

          <div className="absolute inset-0 origin-center scale-[.8] pt-8 sm:scale-100 sm:pt-10">
            <ReleaseVisual kind={r.visual} icon={r.points[0]?.icon ?? Sparkles} />
          </div>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
