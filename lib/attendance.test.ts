import { describe, expect, it } from 'vitest';
import { summarise, summariseAll, EMPTY_ATTENDANCE, counts } from './attendance';

const row = (p: Partial<Parameters<typeof summarise>[0][number]> = {}) => ({
  studentId: 's1', day: '2026-09-13', status: 'PRESENT', lines: [], ...p,
});

describe('حصيلة الحضور', () => {
  it('لا سجلّ ⇒ لا نسبة — لا صفرًا', () => {
    expect(summarise([])).toEqual(EMPTY_ATTENDANCE);
    expect(summarise([]).rate).toBeNull();
  });

  it('«متأخر» حضور تأخّر لا غياب', () => {
    const a = summarise([
      row({ day: '2026-09-13', status: 'PRESENT' }),
      row({ day: '2026-09-14', status: 'LATE' }),
      row({ day: '2026-09-15', status: 'ABSENT' }),
    ]);
    expect(a.attended).toBe(2);
    expect(a.rate).toBe(67);
    expect(counts('LATE')).toBe(true);
    expect(counts('ABSENT')).toBe(false);
  });

  it('واليوم الذي لم يُسجَّل لا يُحسب في الاتجاهين', () => {
    /* ثلاثة أيام سُجّلت من أسبوع — والنسبة عليها وحدها. */
    const a = summarise([
      row({ day: '2026-09-13' }), row({ day: '2026-09-14' }), row({ day: '2026-09-15' }),
    ]);
    expect(a.recorded).toBe(3);
    expect(a.rate).toBe(100);
  });

  it('يعدّ الأسطر والأخطاء من المُسمَّع وحده', () => {
    const a = summarise([row({
      lines: [
        { kind: 'DARS', recited: true, errors: 3 },
        { kind: 'MURAJAA_SUGHRA', recited: false, errors: 9 },
      ],
    })]);
    expect(a.lines).toBe(1);
    expect(a.errors).toBe(3);        // أخطاء ما لم يُسمَّع لا تُحسب
    expect(a.recitedDays).toBe(1);
  });

  it('وسلسلة الغياب تُعدّ من آخر يوم مسجَّل', () => {
    const a = summarise([
      row({ day: '2026-09-13', status: 'ABSENT' }),
      row({ day: '2026-09-14', status: 'PRESENT' }),
      row({ day: '2026-09-15', status: 'ABSENT' }),
      row({ day: '2026-09-16', status: 'ABSENT' }),
    ]);
    expect(a.absentStreak).toBe(2);
    expect(a.lastAttended).toBe('2026-09-14');
    expect(a.lastRecorded).toBe('2026-09-16');
  });

  it('ويفرّق بين الطلاب', () => {
    const m = summariseAll([
      row({ studentId: 'a', status: 'PRESENT' }),
      row({ studentId: 'b', status: 'ABSENT' }),
    ]);
    expect(m.get('a')!.attended).toBe(1);
    expect(m.get('b')!.attended).toBe(0);
  });
});
