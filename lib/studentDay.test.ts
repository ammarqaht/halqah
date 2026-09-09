/* «يومك اليوم — تقديريًا». The estimate has to be right about the thing it
   claims: working days since the sheet was handed over, and nothing else. */
import { describe, expect, it } from 'vitest';
import { estimateCurrentDay } from './studentDay';

const SUN_TO_THU = [0, 1, 2, 3, 4];

describe('estimating which day of his plan a student is on', () => {
  /* 2026-09-06 is a Sunday. */
  it('counts the day the sheet was issued as day one', () => {
    expect(estimateCurrentDay('2026-09-06', 24, SUN_TO_THU, new Date('2026-09-06T18:00:00')))
      .toBe(1);
  });

  it('skips the days the halaqa does not meet', () => {
    /* Sun 6 → Thu 10 is five working days; Fri 11 and Sat 12 are not. */
    expect(estimateCurrentDay('2026-09-06', 24, SUN_TO_THU, new Date('2026-09-10T18:00:00'))).toBe(5);
    expect(estimateCurrentDay('2026-09-06', 24, SUN_TO_THU, new Date('2026-09-11T18:00:00'))).toBe(5);
    expect(estimateCurrentDay('2026-09-06', 24, SUN_TO_THU, new Date('2026-09-12T18:00:00'))).toBe(5);
    /* and the next Sunday resumes at six. */
    expect(estimateCurrentDay('2026-09-06', 24, SUN_TO_THU, new Date('2026-09-13T18:00:00'))).toBe(6);
  });

  it('clamps at both ends', () => {
    /* Before it was issued — he cannot be on day zero. */
    expect(estimateCurrentDay('2026-09-06', 24, SUN_TO_THU, new Date('2026-09-01T18:00:00'))).toBe(1);
    /* Long past the end — the sheet has 24 days and no more. */
    expect(estimateCurrentDay('2026-01-01', 24, SUN_TO_THU, new Date('2026-09-06T18:00:00'))).toBe(24);
  });

  it('does not throw on a plan with no usable date', () => {
    expect(estimateCurrentDay('', 24, SUN_TO_THU)).toBe(1);
  });
});
