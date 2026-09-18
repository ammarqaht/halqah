'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   مؤشّر السكرول — a hairline across the top of the phone, filling from the right.

   «مؤشّر السكرول خلّه باللون الأبيض الخفيف في أعلى الشاشة من يمينها إلى يسارها،
   في كلٍّ من عند الطالب والمعلم» (client, 18 Sep 2026).

   The portals are one long page under a card that fills the screen, and a
   scrollbar on the right edge is the desktop's answer to «كم بقي» — on a phone
   it is hidden, and on a laptop it sits in a rail nobody looks at. This says the
   same thing where the eye already is: across the top, growing from the right
   because that is where Arabic starts.

   It rides ABOVE the hero, which is teal, and over the page below it, which is
   near-white. So it is white on a TRACK OF THE BRAND at a quarter strength: on
   the hero the track is a slightly deeper teal and the fill is white on it; once
   the hero has scrolled away the track is a grey-green and the fill is still the
   lighter of the two. A white line with no track under it would vanish against
   the page the moment it became worth reading.

   Nothing but `width` changes, it is `pointer-events-none`, and it is hidden
   from the accessibility tree — a progress bar nobody can act on is decoration
   to a screen reader, and the page position is not news it needs read aloud.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';

export function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const read = () => {
      const el = document.documentElement;
      const run = el.scrollHeight - el.clientHeight;
      /* A page that does not scroll has no progress to report — and dividing by
         it would put the bar at either 0 or NaN depending on the browser. */
      setPct(run > 24 ? Math.min(100, Math.max(0, (el.scrollTop / run) * 100)) : 0);
    };
    read();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  return (
    <div aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] bg-brand-900/25">
      {/* RTL: a block element with a width starts at the RIGHT edge on its own,
          which is exactly «من يمينها إلى يسارها». */}
      <div className="h-full bg-white/90 transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }} />
    </div>
  );
}
