/* أسبوع الحلقة — الأحد إلى الخميس.
 *
 * Five afternoons, not seven days. Friday and Saturday are not absences to
 * explain away: the halaqa does not meet, so they do not appear at all. Every
 * screen that shows a week — the boy's own attendance, and the supervisor's
 * halaqa register — reads the week from here, so the two can never disagree
 * about which Sunday a Tuesday belongs to.
 *
 * Dates are `YYYY-MM-DD` strings throughout, the shape `day_entries.day` holds.
 * They are compared as strings, which is correct for this format and immune to
 * the timezone traps that catch `Date` arithmetic.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A date-only string as LOCAL midnight — never UTC, which would shift the day
    backwards for anyone west of Greenwich. */
function at(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** الأحد الذي يقع فيه هذا اليوم. Sunday is 0 in JS, which happens to be the
    first day of the week here too — so the shift is the day number itself. */
export function weekOf(day: string): string {
  const d = at(day);
  d.setDate(d.getDate() - d.getDay());
  return iso(d);
}

/** أيام الأسبوع الخمسة، من الأحد إلى الخميس. */
export function weekDays(sunday: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = at(sunday);
    d.setDate(d.getDate() + i);
    out.push(iso(d));
  }
  return out;
}

/** الأسبوع السابق أو التالي. */
export function shiftWeek(sunday: string, by: number): string {
  const d = at(sunday);
  d.setDate(d.getDate() + by * 7);
  return iso(d);
}

/** «الأحد · الاثنين · …» for the five, by position not by locale lookup — the
    order is fixed and a runtime that formats Arabic weekdays differently must
    not be able to move Tuesday. */
export const WEEKDAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'] as const;

const MONTH_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'] as const;

/** «١٢ سبتمبر» — a day and a month, which is how a week is spoken about. */
export function dayLabel(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(d)} ${MONTH_AR[Number(m) - 1] ?? ''}`;
}

/** «١٢ – ١٦ سبتمبر» and, across a month, «٢٩ سبتمبر – ٣ أكتوبر». */
export function weekLabel(sunday: string): string {
  const days = weekDays(sunday);
  const a = days[0], b = days[days.length - 1];
  const [, ma, da] = a.split('-');
  const [, mb, db] = b.split('-');
  const monthA = MONTH_AR[Number(ma) - 1] ?? '';
  const monthB = MONTH_AR[Number(mb) - 1] ?? '';
  return ma === mb
    ? `${Number(da)} – ${Number(db)} ${monthB}`
    : `${Number(da)} ${monthA} – ${Number(db)} ${monthB}`;
}

/**
 * The Saturday that closed the last full week — the week «فرسان الأسبوع» is
 * announced for. «بشكل اسبوعي كل احد يكون فيه اشعار … عن فرسان الأسبوع»
 * (client, 10 Oct 2026): on Sunday it is yesterday, and it stays that Saturday
 * until the next Sunday turns the page. Sunday-to-Saturday covers every
 * halaqa day whatever weekdays a halaqa meets on.
 */
export function lastWeekEnd(today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() - (d.getDay() + 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

