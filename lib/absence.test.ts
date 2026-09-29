import { describe, expect, it } from 'vitest';
import { planAbsences } from './absence';

const roster = [
  { id: 'a', halaqaId: 'h1', since: '2026-09-01' },
  { id: 'b', halaqaId: 'h1', since: '2026-09-01' },
  { id: 'c', halaqaId: 'h1', since: '2026-09-29' },
  { id: 'd', halaqaId: 'h2', since: '2026-09-01' },
];
const base = { roster, today: '2026-09-29', from: '2026-09-15' };

describe('الغياب التلقائي', () => {
  it('يوم مضى وفيه حاضر ⇒ من لم يُحضَّر غائب', () => {
    const plan = planAbsences({ ...base, entries: [
      { studentId: 'a', halaqaId: 'h1', day: '2026-09-27', status: 'PRESENT' },
    ] });
    expect(plan).toEqual([{ studentId: 'b', halaqaId: 'h1', day: '2026-09-27' }]);
  });

  it('المتأخر حاضر، فيكفي لانعقاد الحلقة', () => {
    const plan = planAbsences({ ...base, entries: [
      { studentId: 'a', halaqaId: 'h1', day: '2026-09-27', status: 'LATE' },
    ] });
    expect(plan.map((p) => p.studentId)).toEqual(['b']);
  });

  it('يوم لم يحضر فيه أحد لا يُملأ غيابًا', () => {
    expect(planAbsences({ ...base, entries: [
      { studentId: 'a', halaqaId: 'h1', day: '2026-09-27', status: 'ABSENT' },
    ] })).toEqual([]);
  });

  it('اليوم نفسه لا يُغيَّب فيه أحد — لم ينقضِ بعد', () => {
    expect(planAbsences({ ...base, entries: [
      { studentId: 'a', halaqaId: 'h1', day: '2026-09-29', status: 'PRESENT' },
    ] })).toEqual([]);
  });

  it('حضور حلقة لا يغيّب طلاب حلقة أخرى', () => {
    const plan = planAbsences({ ...base, entries: [
      { studentId: 'a', halaqaId: 'h1', day: '2026-09-27', status: 'PRESENT' },
    ] });
    expect(plan.some((p) => p.studentId === 'd')).toBe(false);
  });

  it('الطالب المضاف بعد اليوم لا يُغيَّب فيه', () => {
    const plan = planAbsences({ ...base, entries: [
      { studentId: 'a', halaqaId: 'h1', day: '2026-09-28', status: 'PRESENT' },
    ] });
    expect(plan.map((p) => p.studentId)).toEqual(['b']);
  });

  it('ما سُجّل لا يُمسّ', () => {
    expect(planAbsences({ ...base, entries: [
      { studentId: 'a', halaqaId: 'h1', day: '2026-09-27', status: 'PRESENT' },
      { studentId: 'b', halaqaId: 'h1', day: '2026-09-27', status: 'ABSENT' },
    ] })).toEqual([]);
  });

  it('لا يتجاوز حدّ الأيام المرجوع إليها', () => {
    expect(planAbsences({ ...base, entries: [
      { studentId: 'a', halaqaId: 'h1', day: '2026-09-10', status: 'PRESENT' },
    ] })).toEqual([]);
  });
});
