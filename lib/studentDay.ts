/**
 * Which day of his plan a student is probably on.
 *
 * NOT WIRED TO ANYTHING YET, and deliberately. The estimate was on the
 * student's screen and is off it again: nothing records which day a boy
 * actually reached, so it was a guess, and a guess there sends a child to the
 * wrong passage on the system's authority. This waits for the teacher's screen
 * to record attendance, at which point the same counting becomes exact.
 *
 * NOTHING in the system records which day a boy actually reached — attendance
 * and recitation live in Ratel, not here. So this counts the halaqa's working
 * days elapsed since the sheet was handed to him, and the UI labels it
 * «تقديريًا» and lets him tap any other day.
 *
 * «النظام يقترح، وأنت تقرّر». A guess dressed as a fact would have a nine year
 * old memorising the wrong passage on the system's authority.
 */
export function estimateCurrentDay(
  issuedAt: string,
  dayCount: number,
  weekdays: number[],
  now: Date = new Date(),
): number {
  const start = new Date(issuedAt);
  if (Number.isNaN(start.getTime()) || dayCount < 1) return 1;

  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (end < d) return 1;

  const runs = new Set(weekdays);
  let elapsed = 0;
  /* The day the sheet was issued counts as day one if the halaqa met that day,
     which is why this counts the start date itself and stops before today+1. */
  while (d <= end) {
    if (runs.has(d.getDay())) elapsed++;
    if (elapsed >= dayCount) break;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(1, Math.min(dayCount, elapsed || 1));
}
