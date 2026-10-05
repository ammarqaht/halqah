'use client';
/* تم تطوير هذا النظام بواسطة مـــداد.
 *
 * At the foot of every screen in the three portals, and on the sign-in pages.
 *
 * The name is SET IN THMANYAH, not drawn from the wordmark image: «هنا وفي كل
 * مكان استعمل نفس خط ثمانية» (client, 5 Oct 2026) — the same line, in the same
 * face, that closes Medad's other systems (Binaa_3taa's MedadCredit): the
 * sentence light, «مـــداد» bold and a step larger, in the brand's deep teal
 * on paper and in sand on the green field.
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
      <b className={cx('text-[15px] font-bold tracking-normal', white ? 'text-[#D9BE83]' : 'text-brand-900')}>
        مـــداد
      </b>
    </footer>
  );
}
