'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   قرص التبويب — the mark that slides along the bottom bar.

   «أبي البار نفسه، ولون تحديد الأيقونة في البار هو اللي ينتقل يمينًا ويسارًا»
   (client, 18 Sep 2026), after the whole PAGE was sliding and he asked for that
   to go back: «الانتقال السلس بين الصفحات ما أبيه على الصفحة نفسها».

   He is right, and the difference is worth stating. Sliding the page animates
   the CONTENT, which is the thing being read — it moves under the eye and costs
   a beat before anything can be looked at. Sliding the highlight animates the
   CONTROL: the bar says «you were there, now you are here» while the screen
   underneath is simply already there. Same information, none of the wait.

   It is MEASURED rather than computed from an index, because the two bars are
   not the same grid: the teacher's is five equal columns and the student's has
   a 76px well in the middle for the raised disc. Measuring asks the browser
   where the tab actually is, so a bar that changes shape cannot put the mark in
   the wrong place.

   `data-tab` marks the flat tabs only. The student's raised disc is `current`
   when it is open, and the mark must not fly into a circle that is above the
   bar rather than in it.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState, type RefObject } from 'react';

type Box = { x: number; w: number };

export function useTabPill(nav: RefObject<HTMLElement | null>, key: string) {
  const [pill, setPill] = useState<Box | null>(null);

  useEffect(() => {
    const read = () => {
      const bar = nav.current;
      const tab = bar?.querySelector<HTMLElement>('[data-tab][aria-current="page"]');
      if (!bar || !tab) { setPill(null); return; }
      const b = bar.getBoundingClientRect();
      const t = tab.getBoundingClientRect();
      setPill({ x: t.left - b.left, w: t.width });
    };
    /* Read straight away: the effect runs after React has committed, so the tab
       that carries `aria-current` is already the new one and the layout it is
       measured against is already valid. The frame after is a backstop for a
       font or an icon that lands late and changes a column's width — and it is
       only a backstop, because a page that is not being painted never runs it. */
    read();
    const id = requestAnimationFrame(read);
    window.addEventListener('resize', read);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', read); };
  }, [nav, key]);

  return pill;
}

/** The mark itself: behind the tabs, taking no clicks, moving on transform. */
export function TabPill({ pill, className }: { pill: Box | null; className?: string }) {
  return (
    <span aria-hidden
      className={className}
      style={{
        position: 'absolute',
        /* Pinned to the PHYSICAL left edge, then pushed by a physical offset.
           Without this the box takes its static position — which in an RTL row
           is the RIGHT edge — and the translate carries it off the screen. */
        left: 0,
        transform: `translateX(${pill?.x ?? 0}px)`,
        width: pill?.w ?? 0,
        opacity: pill ? 1 : 0,
        transition: 'transform .34s cubic-bezier(.22,.61,.36,1), width .34s cubic-bezier(.22,.61,.36,1), opacity .2s ease',
      }} />
  );
}
