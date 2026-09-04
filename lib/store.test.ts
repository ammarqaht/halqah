/* The exam↔ledger join, tested at the store rather than through a screen.
   §9 promises «وعند التعليم على صُرفت تُضاف لرصيد الطالب مباشرة — لا سجلّ منفصل
   ولا نسيان»; §8 promises the ledger is append-only and a balance is Σ delta.
   Those two together mean `saveExam` must reconcile against what the ledger has
   ALREADY paid for that exam, not against a flag — otherwise editing an exam
   twice pays twice, and a supervisor who taps «صرفها كلّها» in a hurry gives a
   student double points with no way to see it happened.

   The store runs in-memory here: it reaches for `localStorage`, does not find
   it under Node, and its own try/catch keeps it working — which is exactly the
   private-browsing path it was written for. */
import { beforeEach, describe, expect, it } from 'vitest';
import { store } from './store';
import type { Exam, Student } from './types';

const student = (over: Partial<Student> = {}): Student => ({
  id: 's1', fullName: 'عمر ناصر الزهراني', nationalId: '1080000000', nationalIdFlag: null,
  track: 'GOLDEN', halaqaId: null, grade: 'رابع ابتدائي', stage: 'ابتدائي',
  nationality: 'سعودي', guardianPhone: '501234567', status: 'ACTIVE', currentLevel: 29, ...over,
});

const exam = (over: Partial<Exam> = {}): Exam => ({
  id: 'e1', studentId: 's1', halaqaId: null, track: 'GOLDEN',
  type: 'BADGE_DIAMOND', takenOn: '2026-08-31', level: 29, ajza: 2,
  errors: 3, warnings: 4, tajweedErrors: 2, score: 90, passed: true,
  pointsAwarded: 200, pointsPaid: true, note: '', examiner: '',
  tajweedTopics: [], source: 'MANUAL', createdAt: '2026-08-31T10:00:00Z', ...over,
});

const ledgerFor = (id: string) => store.get().txns.filter((t) => t.refId === id);
const balance = (sid: string) =>
  store.get().txns.filter((t) => t.studentId === sid).reduce((a, t) => a + t.delta, 0);

beforeEach(() => {
  store.reset();
  store.upsertStudent(student());
});

describe('recording an exam pays its points once', () => {
  it('writes one movement, tied back to the exam', () => {
    store.saveExam(exam());
    const rows = ledgerFor('e1');
    expect(rows).toHaveLength(1);
    expect(rows[0].delta).toBe(200);
    expect(rows[0].kind).toBe('EXAM');
    expect(rows[0].refType).toBe('exam');
    expect(balance('s1')).toBe(200);
  });

  /* The one that matters: «صرفها كلّها» can be tapped twice, an exam can be
     opened and re-saved, and neither may pay a second time. */
  it('is idempotent — saving the same exam again pays nothing more', () => {
    store.saveExam(exam());
    store.saveExam(exam());
    store.saveExam(exam());
    expect(ledgerFor('e1')).toHaveLength(1);
    expect(balance('s1')).toBe(200);
  });

  it('pays nothing until the tick is made', () => {
    store.saveExam(exam({ pointsPaid: false }));
    expect(ledgerFor('e1')).toHaveLength(0);
    expect(balance('s1')).toBe(0);
  });

  it('pays on the later tick, and only then', () => {
    store.saveExam(exam({ pointsPaid: false }));
    store.saveExam(exam({ pointsPaid: true }));
    expect(ledgerFor('e1')).toHaveLength(1);
    expect(balance('s1')).toBe(200);
  });
});

describe('editing an exam corrects the ledger without rewriting it', () => {
  it('un-ticking writes an opposite row rather than removing the first', () => {
    store.saveExam(exam());
    store.saveExam(exam({ pointsPaid: false }));

    const rows = ledgerFor('e1');
    expect(rows).toHaveLength(2);
    expect(rows[0].delta).toBe(200);          // the original stands
    expect(rows[1].delta).toBe(-200);
    expect(rows[1].kind).toBe('CORRECTION');
    expect(balance('s1')).toBe(0);
  });

  it('changing the amount pays only the difference', () => {
    store.saveExam(exam({ pointsAwarded: 200 }));
    store.saveExam(exam({ pointsAwarded: 250 }));
    expect(balance('s1')).toBe(250);
    expect(ledgerFor('e1').map((r) => r.delta)).toEqual([200, 50]);

    store.saveExam(exam({ pointsAwarded: 100 }));
    expect(balance('s1')).toBe(100);
    expect(ledgerFor('e1').map((r) => r.delta)).toEqual([200, 50, -150]);
  });

  it('leaves one exam row however many times it is edited', () => {
    store.saveExam(exam());
    store.saveExam(exam({ score: 95, note: 'أعيد تقييمه' }));
    expect(store.get().exams).toHaveLength(1);
    expect(store.get().exams[0].note).toBe('أعيد تقييمه');
  });
});

describe('talqeen stays outside the points system — §4.11 / §13.1', () => {
  it('records the exam but never the points', () => {
    store.upsertStudent(student({ id: 's2', track: 'TALQEEN', currentLevel: null }));
    store.saveExam(exam({ id: 'e2', studentId: 's2', track: 'TALQEEN', pointsAwarded: 200, pointsPaid: true }));
    expect(store.get().exams).toHaveLength(1);
    expect(ledgerFor('e2')).toHaveLength(0);
    expect(balance('s2')).toBe(0);
  });
});

describe('a re-import never disturbs what the ledger has paid', () => {
  it('keeps exams and movements when the roster is replaced', () => {
    store.saveExam(exam());
    store.replaceAll([student({ fullName: 'عمر ناصر الزهراني' })], [], 'ملف جديد.xlsx');
    expect(store.get().exams).toHaveLength(1);
    expect(balance('s1')).toBe(200);
  });
});
