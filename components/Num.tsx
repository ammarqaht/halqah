/* DESIGN.md §2.2 — bidi isolation.
   Without it RTL reorders "4:45 – 6:15" into "6:15 – 4:45" and scrambles phones. */
import { cx } from '@/lib/cx';

export function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return <bdi dir="ltr" className={cx('num', className)}>{children}</bdi>;
}

const AR = '٠١٢٣٤٥٦٧٨٩';
/** Arabic-Indic digits — printed surfaces only (DESIGN.md §2.2). */
export const toArabicDigits = (v: string | number) =>
  String(v).replace(/[0-9]/g, (d) => AR[+d]);

/**
 * The counted noun alone, in the form the figure demands: Arabic agrees the
 * noun with the number, and `٤ طالبًا` is simply wrong where `٤ طلاب` is right.
 * Separate from `plural` because most callers render the figure themselves
 * inside `<Num>` for bidi isolation, and cannot take a pre-joined string.
 */
export const pluralNoun = (n: number, one: string, two: string, few: string, many: string) =>
  n === 1 ? one : n === 2 ? two : (n % 100 >= 3 && n % 100 <= 10) ? few : many;

/** Number and noun together: خطأ واحد · خطآن · ٣ أخطاء · ١١ خطأ */
export function plural(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1 || n === 2) return pluralNoun(n, one, two, few, many);
  return `${n} ${pluralNoun(n, one, two, few, many)}`;
}

/** The noun this product counts constantly. طالب · طالبان · طلاب · طالبًا */
export const studentWord = (n: number) => pluralNoun(n, 'طالب', 'طالبان', 'طلاب', 'طالبًا');

/** And the other two. بطاقة · بطاقتان · بطاقات · بطاقة — نقطة · نقطتان · نقاط · نقطة */
export const cardWord = (n: number) => pluralNoun(n, 'بطاقة', 'بطاقتان', 'بطاقات', 'بطاقة');
export const pointWord = (n: number) => pluralNoun(n, 'نقطة', 'نقطتان', 'نقاط', 'نقطة');
export const juzWord = (n: number) => pluralNoun(n, 'جزء', 'جزآن', 'أجزاء', 'جزءًا');
export const orderWord = (n: number) => pluralNoun(n, 'طلب', 'طلبان', 'طلبات', 'طلبًا');
