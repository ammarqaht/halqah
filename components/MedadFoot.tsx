'use client';
/* تم تطوير هذا النظام بواسطة مـــداد.
 *
 * At the foot of every screen in the three portals, and on the sign-in pages.
 *
 * The name is SET IN THMANYAH, not drawn from the wordmark image: «هنا وفي كل
 * مكان استعمل نفس خط ثمانية» (client, 5 Oct 2026) — and in the wordmark's own
 * face, Thmanyah Serif Display Bold with the long stretch «مـــــداد», as the
 * Medad site sets it: «اعتمد خط ثمانية حقنا الي نستعمله بالشعار» (9 Oct). Deep
 * teal on paper, sand on the green field.
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
import { cx } from '@/lib/cx';

export function MedadFoot({
  white = false,
  className = '',
}: { white?: boolean; className?: string }) {
  return (
    <footer
      className={cx('no-print flex items-baseline justify-center gap-1.5 py-7 text-center font-sans', className)}>
      <span className={cx('text-xs2', white ? 'text-white/60' : 'text-ink-400')}>
        تم تطوير هذا النظام بواسطة
      </span>
      {/* Thmanyah Serif Display, Bold — the face of the Medad wordmark itself,
          with its long stretch. Set in the sans it broke apart (client, 9 Oct). */}
      <b className={cx('font-display text-[17px] font-bold leading-none tracking-normal',
        white ? 'text-[#D9BE83]' : 'text-brand-900')}>
        مـــــداد
      </b>
    </footer>
  );
}
