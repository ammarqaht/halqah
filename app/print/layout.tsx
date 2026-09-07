'use client';
/* Print routes — DESIGN.md §8. No rail, no panel, no TopBar: what is on the
   screen is what comes out of the printer, and anything else would be a lie
   about the sheet. The only on-screen chrome is a print button that carries
   `no-print` and removes itself from the output.

   That button is also removed when the sheet is being previewed inside the
   reports screen — the screen already carries its own print button above the
   frame, and two of them side by side is one too many. */
import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  const [embedded, setEmbedded] = useState(false);
  /* Read after mount: on the server there is no window to be framed by, and
     guessing would flash the wrong chrome. */
  useEffect(() => {
    try { setEmbedded(window.self !== window.top); } catch { setEmbedded(true); }
  }, []);

  return (
    <div className={cx('min-h-screen print:bg-white print:py-0',
      embedded ? 'embedded bg-white py-0' : 'bg-ink-100 py-8')}>
      {children}
    </div>
  );
}
