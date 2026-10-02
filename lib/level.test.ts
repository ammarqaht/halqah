import { describe, expect, it } from 'vitest';
import { levelOf, planOf, pointerOf } from './level';

/* «الطالب محمد عدلت المستوى حقه لكن في خانة الي اضبط له … لا يزال 48»
   (client, 2 Oct 2026) — the roster moved to 47, the pointer stayed on 48. */
const p48 = { level: 48, track: 'SILVER', issuedAt: '2026-09-01T00:00:00Z' };
const p47 = { level: 47, track: 'SILVER', issuedAt: '2026-10-02T00:00:00Z' };
const moved = { currentLevel: 47, track: 'SILVER',
  progress: { level: 48, assignmentNo: 14, awaitingExam: null } };

describe('lib/level', () => {
  it('reads the roster level before a stale pointer', () => {
    expect(levelOf(moved, [p48])).toBe(47);
  });

  it('drops a pointer left on the previous level', () => {
    expect(pointerOf(moved, [p48])).toBeNull();
  });

  it('keeps the pointer while it is on his level', () => {
    const s = { ...moved, progress: { level: 47, assignmentNo: 3, awaitingExam: null } };
    expect(pointerOf(s, [p48, p47])?.assignmentNo).toBe(3);
  });

  it('takes the sheet for his level, not a newer one for another level', () => {
    const edited = { level: 50, track: 'SILVER', issuedAt: '2026-10-05T00:00:00Z' };
    expect(planOf(moved, [p48, p47, edited])?.level).toBe(47);
  });

  it('has no sheet when none was issued for his new level', () => {
    expect(planOf(moved, [p48])).toBeNull();
  });

  it('falls back to the newest sheet, then the pointer, when the roster is blank', () => {
    const blank = { currentLevel: null, progress: { level: 52, assignmentNo: 1 } };
    expect(levelOf(blank, [p48])).toBe(48);
    expect(levelOf(blank, [])).toBe(52);
  });
});
