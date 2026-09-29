'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   التنبيهات حبّةً حبّة — what is new, put in front of him the moment he arrives.

   «ودّي التنبيهات والإعلانات تطلع للشيخ بوجهه حبّة ورا حبّة أول ما يدخل الموقع،
   وفيه زر التالي أو إكس عشان يشوف اللي بعده، وخلاص تصير كأنها مقروءة دون
   الحاجة لزر التنبيهات فوق. ونفس الكلام لموقع الطلاب» (client, 29 Sep 2026).

   So: one card at a time, the unread ones only, newest first. «التالي» and ✕
   both move on, and each marks the card it leaves as read — the bell is still
   there for looking back, but nobody has to open it to clear what is new. The
   queue is taken ONCE, when the unread list first arrives; ticking one off
   reloads that list, and a queue that followed it would reshuffle under his
   thumb.

   One component for both portals: they differ in what an alert is called and
   where it leads, and the caller maps that into `StoryItem`.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Lattice } from '@/components/Lattice';
import { Num } from '@/components/Num';
import { formatDate, relativeDay } from '@/lib/dates';
import { cx } from '@/lib/cx';

export type StoryItem = {
  key: string;
  icon: LucideIcon;
  /** What kind of thing this is — «من الإدارة»، «نتيجة»… */
  label: string;
  /** A headline when the alert has one; the body stands alone when not. */
  title?: string;
  body: string;
  at?: string;
  href?: string;
};

export function AlertStory({ items, ready, onSeen }: {
  /** The unread alerts. Read once, when `ready` first turns true. */
  items: StoryItem[];
  ready: boolean;
  onSeen: (keys: string[]) => void;
}) {
  const [queue, setQueue] = useState<StoryItem[] | null>(null);
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const taken = useRef(false);

  useEffect(() => {
    if (!ready || taken.current) return;
    taken.current = true;
    if (items.length) setQueue(items);
  }, [ready, items]);

  const open = !!queue && i < queue.length;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => {
    setLeaving(true);
    setTimeout(() => { setQueue(null); setLeaving(false); }, 260);
  };

  /* Leaving a card is reading it. */
  const next = () => {
    if (!queue) return;
    onSeen([queue[i].key]);
    if (i + 1 >= queue.length) close();
    else setI(i + 1);
  };

  const skipAll = () => {
    if (!queue) return;
    onSeen(queue.slice(i).map((q) => q.key));
    close();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!open || !queue) return null;
  const a = queue[i];
  const I = a.icon;
  const day = a.at ? a.at.slice(0, 10) : '';
  const last = i === queue.length - 1;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="تنبيه جديد"
      className={cx('fixed inset-0 z-[80] grid place-items-center p-5 transition-opacity duration-300',
        leaving ? 'opacity-0' : 'fade')}>
      <div className="absolute inset-0 bg-brand-900/55 backdrop-blur-[6px]" />

      <div className={cx('relative w-full max-w-[25rem] overflow-hidden rounded-[22px] bg-paper',
        'shadow-[0_30px_80px_-20px_rgba(10,64,60,.55),0_0_0_1px_rgba(255,255,255,.06)]')}>

        {/* ── the crown: green, the lattice, the progress, the medallion ── */}
        <div className="relative overflow-hidden bg-gradient-to-b from-brand-900 to-brand-800 px-5 pb-12 pt-4 text-white">
          <Lattice className="pointer-events-none absolute inset-0 h-full w-full text-white" opacity={0.08} />
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-brand-600/25 blur-3xl" />

          {queue.length > 1 && (
            <div className="relative flex gap-1" aria-hidden>
              {queue.map((q, n) => (
                <span key={q.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
                  <span className={cx('block h-full rounded-full bg-[#D9BE83] transition-[width] duration-500 ease-brand',
                    n <= i ? 'w-full' : 'w-0')} />
                </span>
              ))}
            </div>
          )}

          <div className="relative mt-3 flex items-center justify-between">
            <span className="text-micro tracking-[.12em] text-white/70">
              {queue.length > 1
                ? <><Num>{i + 1}</Num> من <Num>{queue.length}</Num></>
                : 'تنبيه جديد'}
            </span>
            <button type="button" onClick={next} aria-label="التالي"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/20">
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* The medallion sits on the seam between the crown and the page. */}
        <div className="relative -mt-9 flex justify-center">
          <span key={`m${i}`} className="mark-in grid h-[72px] w-[72px] place-items-center rounded-full bg-paper p-[5px] shadow-[0_10px_30px_-10px_rgba(10,64,60,.5)]">
            <span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-brand-800 to-brand-900 text-[#E7D3A5] ring-2 ring-[#D9BE83]/70">
              <I size={26} strokeWidth={1.7} />
            </span>
          </span>
        </div>

        {/* ── the page ── */}
        <div key={i} className="mark-in px-6 pb-2 pt-3 text-center">
          <p className="text-micro font-medium tracking-[.14em] text-warn-700">{a.label}</p>
          {a.title && (
            <h2 className="mt-1.5 font-display text-t1 text-ink-900">{a.title}</h2>
          )}
          <p className={cx('mx-auto max-w-[21rem] whitespace-pre-line leading-relaxed text-ink-700',
            a.title ? 'mt-2 text-base2' : 'mt-2 font-display text-xl2 text-ink-900')}>
            {a.body}
          </p>
          {day && (
            <p className="mt-3 text-cap text-ink-400">
              {relativeDay(day)} · <Num>{formatDate(day)}</Num>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 px-6 pb-5 pt-4">
          <button type="button" onClick={next} autoFocus
            className="press flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-900 text-base2 font-medium text-white shadow-[0_8px_20px_-10px_rgba(10,64,60,.8)] transition-colors hover:bg-brand-800">
            {last ? 'تمّ' : <>التالي <ChevronLeft size={18} strokeWidth={2} /></>}
          </button>
          <div className="flex items-center justify-center gap-4 text-panel">
            {a.href && (
              <Link href={a.href} onClick={() => { onSeen([a.key]); close(); }}
                className="font-medium text-brand-800 underline-offset-4 hover:underline">
                اذهب إليه
              </Link>
            )}
            {!last && (
              <button type="button" onClick={skipAll} className="text-ink-500 hover:text-ink-700">
                تخطَّ الكل
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
