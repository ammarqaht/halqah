/* SPEC.md §4: «Unit-test every one of these — they encode client decisions and a
   silent bug here corrupts every screen.» As with `points.test.ts`, every figure
   asserted below is quoted from the approved PDF (§9, §11, §13) rather than read
   back out of the implementation. */
import { describe, expect, it } from 'vitest';
import {
  SCORE_DEDUCTIONS, PASSING_SCORE, nextLevel, ajzaForLevel, isMidJuz,
  scoreFromCounters, isPassing, isPassingFor, scoreMax, passMarkFor,
  totalCounts, readyForAssociation, suggestionAfter,
  LEVEL_LATE_AFTER_DAYS, daysSince, isLate, examOverdue,
} from './exams';

describe('level progression — §4.1', () => {
  it('counts down by one, on both tracks', () => {
    expect(nextLevel(26)).toBe(25);
    expect(nextLevel(60)).toBe(59);
  });
  it('stops at one — there is no level zero', () => {
    expect(nextLevel(1)).toBe(1);
  });
});

describe('level → juz — §4.2, from «قائمة المستويات»', () => {
  /* الذهبي: ٣٠=جزء، ٢٩=جزآن، ٢٨=ثلاثة… كل مستوى جزء. */
  it.each([[30, 1], [29, 2], [28, 3], [1, 30]])('golden %i = %i juz', (level, want) => {
    expect(ajzaForLevel('GOLDEN', level)).toBe(want);
  });

  /* الفضي: ٥٩=جزء، ٥٧=جزآن، ٥٥=ثلاثة… كل مستويين جزء. */
  it.each([[59, 1], [57, 2], [55, 3], [1, 30]])('silver %i = %i juz', (level, want) => {
    expect(ajzaForLevel('SILVER', level)).toBe(want);
  });

  /* The whole reason this returns null rather than rounding: §4.8 gates
     association readiness on a WHOLE juz, and a rounded half would open the
     gate early for every other silver level. */
  it('a silver even level sits mid-juz and has no whole-juz value', () => {
    expect(ajzaForLevel('SILVER', 60)).toBeNull();
    expect(ajzaForLevel('SILVER', 58)).toBeNull();
    expect(isMidJuz('SILVER', 58)).toBe(true);
    expect(isMidJuz('SILVER', 57)).toBe(false);
    expect(isMidJuz('GOLDEN', 28)).toBe(false);
  });

  it('talqeen has no levels at all — §13.1', () => {
    expect(ajzaForLevel('TALQEEN', 10)).toBeNull();
    expect(ajzaForLevel(null, 10)).toBeNull();
    expect(ajzaForLevel('SILVER', null)).toBeNull();
  });
});

describe('score from the counters — §4.4 / §13.4', () => {
  it('starts at 100 with nothing against it', () => {
    expect(scoreFromCounters({ errors: 0, warnings: 0, tajweedErrors: 0 })).toBe(100);
  });

  it('deducts 2 an error, half a warning, 1 a tajweed error', () => {
    expect(SCORE_DEDUCTIONS).toEqual({ error: 2, warning: 0.5, tajweedError: 1 });
    expect(scoreFromCounters({ errors: 1, warnings: 0, tajweedErrors: 0 })).toBe(98);
    expect(scoreFromCounters({ errors: 0, warnings: 1, tajweedErrors: 0 })).toBe(99.5);
    expect(scoreFromCounters({ errors: 0, warnings: 0, tajweedErrors: 1 })).toBe(99);
  });

  it('adds the three together', () => {
    // 100 − 2×3 − 0.5×4 − 1×2 = 90
    expect(scoreFromCounters({ errors: 3, warnings: 4, tajweedErrors: 2 })).toBe(90);
  });

  /* «والخصم ثابت لا يتغيّر باختلاف عدد الأجزاء المختَبرة» — the juz count is
     deliberately not an input, so there is nothing here to test it against. */
  it('never goes below zero, however bad the recitation', () => {
    expect(scoreFromCounters({ errors: 60, warnings: 0, tajweedErrors: 0 })).toBe(0);
    expect(scoreFromCounters({ errors: 200, warnings: 200, tajweedErrors: 200 })).toBe(0);
  });

  it('keeps halves exact rather than drifting into float noise', () => {
    expect(scoreFromCounters({ errors: 0, warnings: 7, tajweedErrors: 0 })).toBe(96.5);
    expect(scoreFromCounters({ errors: 0, warnings: 3, tajweedErrors: 0 })).toBe(98.5);
  });

  it('sums an on-site sheet before scoring it', () => {
    expect(totalCounts([
      { errors: 1, warnings: 2, tajweedErrors: 0 },
      { errors: 2, warnings: 0, tajweedErrors: 1 },
      { errors: 0, warnings: 2, tajweedErrors: 1 },
    ])).toEqual({ errors: 3, warnings: 4, tajweedErrors: 2 });
  });
});

describe('the pass mark — §4.5 / §13.3', () => {
  it('is 80, the same for every exam type', () => {
    expect(PASSING_SCORE).toBe(80);
  });
  it('is inclusive at the boundary', () => {
    expect(isPassing(80)).toBe(true);
    expect(isPassing(79.5)).toBe(false);
    expect(isPassing(100)).toBe(true);
  });
  it('says nothing about a score that has not been given', () => {
    expect(isPassing(null)).toBe(false);
  });

  /* The one place the PDF contradicts itself: §9 records a tajweed exam out of
     10, §11 puts the bar at 80 out of 100 «والتجويد». Both are honoured by
     judging each type on its own scale. Flagged in SPEC §9(h). */
  describe('a tajweed exam is scored on its own scale — §9 vs §11', () => {
    it('is entered out of 10, as the client file records it', () => {
      expect(scoreMax('TAJWEED')).toBe(10);
      expect(scoreMax('BADGE_GOLDEN')).toBe(100);
      expect(scoreMax('ASSOCIATION')).toBe(100);
    });
    it('passes at the same proportion — 8 of 10 is 80 of 100', () => {
      expect(passMarkFor('TAJWEED')).toBe(8);
      expect(passMarkFor('ASSOCIATION')).toBe(80);
      expect(isPassingFor('TAJWEED', 8)).toBe(true);
      expect(isPassingFor('TAJWEED', 7.5)).toBe(false);
      expect(isPassingFor('TAJWEED', 10)).toBe(true);
    });
    it('does not let a tajweed score be judged on the 100 scale by accident', () => {
      expect(isPassingFor('TAJWEED', 9)).toBe(true);
      expect(isPassing(9)).toBe(false);
    });
  });
});

describe('ready for the association exam — §4.8 / §13.6', () => {
  const diamond = (ajza: number) => ({ type: 'BADGE_DIAMOND', passed: true, ajza });
  const assoc = (ajza: number) => ({ type: 'ASSOCIATION', passed: true, ajza });

  it('needs both conditions together', () => {
    // golden 29 ⇒ 2 juz, and the diamond on those 2 juz was passed
    const r = readyForAssociation({ track: 'GOLDEN', level: 29, exams: [diamond(2)] });
    expect(r).toEqual({ ready: true, ajza: 2, reason: null });
  });

  /* §9(d): the diamond alone advances — the supervisor prints the next sheet
     without waiting for the association, and «فمن تحقّق فيه الشرطان ولم يُختبر
     بالجمعية بعد، ظهر في كشف الجاهزين» must keep holding for the juz he DID
     complete. He stays listed until the association examines him on it. */
  it('keeps a student listed after he advances to the next level', () => {
    // passed the diamond on juz 2 at level 29, now holding the level-28 sheet
    expect(readyForAssociation({ track: 'GOLDEN', level: 28, exams: [diamond(2)] }))
      .toEqual({ ready: true, ajza: 2, reason: null });
    // silver mid-juz level: still listed for the juz he finished
    expect(readyForAssociation({ track: 'SILVER', level: 58, exams: [diamond(1)] }))
      .toEqual({ ready: true, ajza: 1, reason: null });
  });

  it('reports the furthest juz when several await the association', () => {
    const r = readyForAssociation({ track: 'GOLDEN', level: 27, exams: [diamond(1), diamond(2)] });
    expect(r).toEqual({ ready: true, ajza: 2, reason: null });
  });

  it('refuses a level that has not completed a whole juz, with no diamond behind it', () => {
    const r = readyForAssociation({ track: 'SILVER', level: 58, exams: [] });
    expect(r.ready).toBe(false);
    expect(r.ajza).toBeNull();
  });

  it('refuses when no diamond was ever passed', () => {
    expect(readyForAssociation({ track: 'GOLDEN', level: 29, exams: [] }).ready).toBe(false);
    // sat the diamond on the right juz but did not pass it
    expect(readyForAssociation({
      track: 'GOLDEN', level: 29, exams: [{ type: 'BADGE_DIAMOND', passed: false, ajza: 2 }],
    }).ready).toBe(false);
  });

  /* «فمن تحقّق فيه الشرطان ولم يُختبر بالجمعية بعد» — the list is of students
     still waiting, so one already examined on that juz drops off it. */
  it('drops a student the association has already examined on that juz', () => {
    const r = readyForAssociation({ track: 'GOLDEN', level: 29, exams: [diamond(2), assoc(2)] });
    expect(r.ready).toBe(false);
    expect(r.reason).toContain('الجمعية');
  });

  it('still lists him when the earlier association exam was a different juz', () => {
    expect(readyForAssociation({
      track: 'GOLDEN', level: 29, exams: [diamond(2), assoc(1)],
    }).ready).toBe(true);
  });

  it('never lists a talqeen student', () => {
    expect(readyForAssociation({ track: 'TALQEEN', level: null, exams: [] }).ready).toBe(false);
  });
});

describe('late on level — §4.9', () => {
  /* Local-time strings on purpose: a `Z` suffix would make the expected day
     count depend on the machine's timezone. */
  const at = (iso: string) => new Date(iso);

  it('counts calendar days, ignoring the time of day', () => {
    // issued at ten in the evening ⇒ one day old the next morning, not zero
    expect(daysSince('2026-08-31T22:00:00', at('2026-09-01T08:00:00'))).toBe(1);
    expect(daysSince('2026-09-01T08:00:00', at('2026-09-01T23:00:00'))).toBe(0);
  });

  it('has nothing to measure without a date', () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince('ليس تاريخًا')).toBeNull();
  });

  /* `takenOn` is written date-only ('YYYY-MM-DD'). The engine parses that
     shape as UTC midnight, which on a machine west of UTC used to collapse it
     to the previous local day and flag the 35-day boundary one day early.
     `asDate` pins a date-only string to the LOCAL day in every timezone. */
  it('keeps a date-only string on its own calendar day in any timezone', () => {
    expect(daysSince('2026-08-25', at('2026-08-26T01:00:00'))).toBe(1);
    expect(daysSince('2026-08-25', at('2026-08-25T23:00:00'))).toBe(0);
  });

  /* «أعطيته ٢٦ في شهر ٧، المفروض ينتقل خلال شهر» — §3.8 puts the line at 35. */
  it('turns late strictly after 35 days from issue', () => {
    expect(LEVEL_LATE_AFTER_DAYS).toBe(35);
    const plan = { issuedAt: '2026-07-01T10:00:00' };
    expect(isLate(plan, at('2026-08-05T10:00:00'))).toBe(false);  // day 35 — on time still
    expect(isLate(plan, at('2026-08-06T10:00:00'))).toBe(true);   // day 36 — late
  });

  it('a student with no plan is «لا توجد خطة», not late', () => {
    expect(isLate(null)).toBe(false);
    expect(isLate(undefined)).toBe(false);
  });
});

describe('not examined recently — §6.1', () => {
  const at = (iso: string) => new Date(iso);

  it('is overdue strictly after the threshold', () => {
    expect(examOverdue('2026-07-01T10:00:00', at('2026-08-05T10:00:00'))).toBe(false);
    expect(examOverdue('2026-07-01T10:00:00', at('2026-08-06T10:00:00'))).toBe(true);
  });

  /* The list exists to surface exactly the student everyone forgot. */
  it('a student never examined at all is overdue, not invisible', () => {
    expect(examOverdue(null)).toBe(true);
  });
});

describe('what the supervisor is offered after a pass — §9', () => {
  /* «اجتاز ٢٦، المفروض أطبع له ٢٥» — his own sentence. */
  it('offers the next level after a passed diamond', () => {
    expect(suggestionAfter({ type: 'BADGE_DIAMOND', passed: true }, 26)).toEqual({ printLevel: 25 });
  });
  it('offers nothing after a failure, or after any other exam type', () => {
    expect(suggestionAfter({ type: 'BADGE_DIAMOND', passed: false }, 26)).toBeNull();
    expect(suggestionAfter({ type: 'BADGE_GOLDEN', passed: true }, 26)).toBeNull();
    expect(suggestionAfter({ type: 'ASSOCIATION', passed: true }, 26)).toBeNull();
  });
});
