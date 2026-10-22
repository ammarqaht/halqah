/* المتجر: عرض فقط، أو مفتوح للطلب.

   «بخصوص المتجر والهدايا نبي نسوي طريقة بس عرض دون الطلب — فقط عرض، بعدين
   ممكن نفتح الطلب لها» (client, 22 Oct 2026).

   One switch, in `settings` under STORE_ORDERING_KEY. ABSENT means display
   only: that is what the client asked for now, and the supervisor opens
   ordering from «المتجر» when he is ready. The student's screen hides the
   button, and the order route refuses on its own — a hidden button is not a
   closed door. */
export const STORE_ORDERING_KEY = 'store_ordering';

export const orderingOpen = (value: unknown) => value === true;

export const STORE_CLOSED_AR = 'المتجر للعرض الآن — اجمع نقاطك، والطلب يُفتح قريبًا بإذن الله.';
