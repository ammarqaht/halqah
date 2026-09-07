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

/**
 * Number and noun as JSX, the figure bidi-isolated per DESIGN.md §2.2 — for
 * counts sitting inside Arabic prose, where `plural()`'s plain string would
 * leave an unisolated Latin run. Singular and dual carry no figure at all.
 */
export function Count({ n, one, two, few, many }:
  { n: number; one: string; two: string; few: string; many: string }) {
  if (n === 1 || n === 2) return <>{pluralNoun(n, one, two, few, many)}</>;
  return <><Num className="font-medium">{n}</Num> {pluralNoun(n, one, two, few, many)}</>;
}

/** The noun this product counts constantly. طالب · طالبان · طلاب · طالبًا */
export const studentWord = (n: number) => pluralNoun(n, 'طالب', 'طالبان', 'طلاب', 'طالبًا');

/** And the other two. بطاقة · بطاقتان · بطاقات · بطاقة — نقطة · نقطتان · نقاط · نقطة */
export const cardWord = (n: number) => pluralNoun(n, 'بطاقة', 'بطاقتان', 'بطاقات', 'بطاقة');
export const pointWord = (n: number) => pluralNoun(n, 'نقطة', 'نقطتان', 'نقاط', 'نقطة');
export const juzWord = (n: number) => pluralNoun(n, 'جزء', 'جزآن', 'أجزاء', 'جزءًا');

/**
 * The whole phrase, figure included: «جزء» · «جزآن» · «٣ أجزاء» · «١١ جزءًا».
 * `juzWord` alone returns the NOUN — callers are meant to render the figure
 * themselves, and the ones that forgot printed a bare «أجزاء» that named no
 * quantity at all.
 *
 * Half a juz is a real value here, not a rounding: a silver EVEN level sits
 * between two whole juz, and «منتصف الجزء» said which levels those were
 * without ever saying which juz. `.5` is spelled out instead.
 */
export function juzPhrase(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  if (!half) return whole === 1 || whole === 2 ? juzWord(whole) : `${whole} ${juzWord(whole)}`;
  if (whole === 0) return 'نصف جزء';
  return `${whole === 1 || whole === 2 ? juzWord(whole) : `${whole} ${juzWord(whole)}`} ونصف`;
}
export const orderWord = (n: number) => pluralNoun(n, 'طلب', 'طلبان', 'طلبات', 'طلبًا');
