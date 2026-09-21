'use client';
/* تم تطوير هذا النظام بواسطة مـــداد.
 *
 * At the foot of every screen in the three portals, and on the two sign-in
 * pages. The mark is the supplied wordmark — never redrawn and never
 * recoloured, the same rule the mosque's and the association's marks follow in
 * components/Logo.tsx.
 *
 * It sits INSIDE the scrolling area rather than fixed to the viewport. Fixed,
 * it would cover the supervisor's work area (whose `main` is the only thing
 * that scrolls) and hover over the phone's bottom bar. At the end of the
 * content it is what it should be: the last thing on the page, reached by
 * scrolling to the end of it.
 *
 * And it does NOT go on a printed sheet. «ما على الشاشة هو ما يخرج من
 * الطابعة» is a rule about fidelity, not about adding to the paper: every
 * report was measured against the real A4 box and fits by a known margin, and
 * a footer nobody accounted for is how a one-page report becomes two. The
 * printed sheets carry the association's and the mosque's marks, which is
 * whose paper it is.
 */
import { useState } from 'react';
import { cx } from '@/lib/cx';

export function MedadFoot({
  white = false,
  className = '',
}: { white?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <footer
      className={cx('no-print flex items-center justify-center gap-2 py-7 text-center', className)}>
      <span className={cx('text-cap', white ? 'text-white/55' : 'text-ink-400')}>
        تم تطوير هذا النظام بواسطة
      </span>

      {failed ? (
        /* The wordmark IS the name, so when the image cannot load the name is
           what replaces it — never an empty box where a brand should be. */
        <span className={cx('font-display text-panel', white ? 'text-white/75' : 'text-brand-700')}>
          مــداد
        </span>
      ) : (
        <img
          src={white ? '/assets/medad-cream.png' : '/assets/medad-teal.png'}
          alt="مداد"
          onError={() => setFailed(true)}
          /* 785×244 native; 14px tall sets it beside the line of text at the
             weight of the words rather than above them. */
          style={{ height: 14, width: 'auto' }}
          className={cx('shrink-0', white ? 'opacity-75' : 'opacity-90')}
        />
      )}
    </footer>
  );
}
