import { describe, expect, it } from 'vitest';
import { weekOf, weekDays, shiftWeek, weekLabel, WEEKDAY_AR } from './week';

/* الأحد إلى الخميس. Friday and Saturday are not absences to explain — the
   halaqa does not meet, so they never appear. */
describe('أسبوع الحلقة', () => {
  it('يبدأ من الأحد', () => {
    // 2026-09-16 هو أربعاء
    expect(weekOf('2026-09-16')).toBe('2026-09-13');
    expect(weekOf('2026-09-13')).toBe('2026-09-13');   // الأحد نفسه
    expect(weekOf('2026-09-17')).toBe('2026-09-13');   // الخميس
  });

  it('والجمعة والسبت يقعان في الأسبوع التالي', () => {
    expect(weekOf('2026-09-18')).toBe('2026-09-13');   // الجمعة — آخر الأسبوع
    expect(weekOf('2026-09-19')).toBe('2026-09-13');   // السبت
    expect(weekOf('2026-09-20')).toBe('2026-09-20');   // الأحد التالي
  });

  it('خمسة أيام لا سبعة', () => {
    const d = weekDays('2026-09-13');
    expect(d).toHaveLength(5);
    expect(d[0]).toBe('2026-09-13');
    expect(d[4]).toBe('2026-09-17');
    expect(WEEKDAY_AR).toHaveLength(5);
  });

  it('والتنقّل بين الأسابيع', () => {
    expect(shiftWeek('2026-09-13', -1)).toBe('2026-09-06');
    expect(shiftWeek('2026-09-13', 1)).toBe('2026-09-20');
  });

  it('ويعبر الشهر والسنة', () => {
    expect(weekOf('2026-01-01')).toBe('2025-12-28');
    expect(weekDays('2026-09-27')[4]).toBe('2026-10-01');
    expect(weekLabel('2026-09-27')).toBe('27 سبتمبر – 1 أكتوبر');
    expect(weekLabel('2026-09-13')).toBe('13 – 17 سبتمبر');
  });
});
