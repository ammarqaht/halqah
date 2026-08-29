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

/** Arabic number agreement: خطأ واحد · خطآن · ٣ أخطاء · ١١ خطأ */
export function plural(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n % 100 >= 3 && n % 100 <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}
