/* «كم بقي على اختباري» — the rules the student's banner follows.
   Pure, so they can be asserted without a database: the route applies exactly
   these three filters and this arithmetic. */
import { describe, expect, it } from 'vitest';

/** Days between two ISO dates, floored at zero. Mirrors /api/student/me. */
const daysAway = (from: string, to: string) => Math.max(0, Math.round(
  (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000));

type B = { scheduledOn: string; status: string };
/** The three filters the query applies, in order. */
const nextOf = (today: string, bookings: B[]) =>
  bookings
    .filter((b) => b.status === 'BOOKED' && b.scheduledOn >= today)
    .sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))[0] ?? null;

describe('which booking a student is warned about', () => {
  const T = '2026-09-12';

  it('is the soonest one still ahead of him', () => {
    expect(nextOf(T, [
      { scheduledOn: '2026-10-02', status: 'BOOKED' },
      { scheduledOn: '2026-09-17', status: 'BOOKED' },
    ])?.scheduledOn).toBe('2026-09-17');
  });

  it('ignores a sitting already done or cancelled', () => {
    /* He is not warned about an exam he has taken. */
    expect(nextOf(T, [
      { scheduledOn: '2026-09-13', status: 'DONE' },
      { scheduledOn: '2026-09-14', status: 'CANCELLED' },
      { scheduledOn: '2026-09-17', status: 'BOOKED' },
    ])?.scheduledOn).toBe('2026-09-17');
  });

  it('ignores a date that has passed, so nothing counts down into the negative', () => {
    expect(nextOf(T, [{ scheduledOn: '2026-09-09', status: 'BOOKED' }])).toBeNull();
  });

  it('keeps today, because today still has an exam on it', () => {
    expect(nextOf(T, [{ scheduledOn: T, status: 'BOOKED' }])?.scheduledOn).toBe(T);
  });

  it('counts the days the way a boy would', () => {
    expect(daysAway(T, T)).toBe(0);              // اليوم
    expect(daysAway(T, '2026-09-13')).toBe(1);   // غدًا
    expect(daysAway(T, '2026-09-14')).toBe(2);   // بعد يومين
    expect(daysAway(T, '2026-09-17')).toBe(5);
    /* Across a month boundary, which is where naive day arithmetic breaks. */
    expect(daysAway(T, '2026-10-02')).toBe(20);
  });
});
