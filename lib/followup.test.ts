/* The follow-up sheet is read in one glance and trusted in the same glance —
   a wrong «آخر اختبار» column sends the supervisor to re-examine the wrong
   student. Fixtures below are minimal rows, not imports. */
import { describe, expect, it } from 'vitest';
import { followUpRows, followedRows, listRows, listCounts, TOP_LIST_SIZE } from './followup';
import type { Exam, PointTxn, Student, StudentPlan } from './types';

const NOW = new Date('2026-09-01T12:00:00');

const student = (over: Partial<Student>): Student => ({
  id: 's1', fullName: 'طالب', nationalId: null, nationalIdFlag: null,
  track: 'GOLDEN', halaqaId: 'h1', grade: 'أول متوسط', stage: 'متوسط',
  nationality: 'سعودي', guardianPhone: '', status: 'ACTIVE', currentLevel: 29,
  ...over,
});

const plan = (over: Partial<StudentPlan>): StudentPlan => ({
  id: 'p1', studentId: 's1', track: 'GOLDEN', level: 29,
  issuedAt: '2026-08-20T09:00:00', issuedBy: 'المشرف', dayCount: 24,
  examDays: { BADGE_GOLDEN: 12, BADGE_DIAMOND: 24 }, dailyAmount: 'صفحة',
  printedCount: 1, createdAt: '2026-08-20T09:00:00',
  ...over,
});

const exam = (over: Partial<Exam>): Exam => ({
  id: 'e1', studentId: 's1', halaqaId: 'h1', track: 'GOLDEN',
  type: 'BADGE_GOLDEN', takenOn: '2026-08-25', level: 29, ajza: 2,
  errors: 0, warnings: 0, tajweedErrors: 0, score: 100, passed: true,
  pointsAwarded: 0, pointsPaid: false, note: '', examiner: 'المشرف',
  tajweedTopic: null, source: 'MANUAL', createdAt: '2026-08-25T10:00:00',
  ...over,
});

const txn = (over: Partial<PointTxn>): PointTxn => ({
  id: 't1', studentId: 's1', delta: 50, kind: 'EXAM', reason: 'اجتياز',
  createdBy: 'المشرف', createdAt: '2026-08-25T10:00:00',
  ...over,
});

const rowsFor = (db: {
  students?: Student[]; plans?: StudentPlan[]; exams?: Exam[]; txns?: PointTxn[];
}) => followUpRows(
  { students: [student({})], plans: [], exams: [], txns: [], ...db }, NOW);

describe('the current sheet — latest plan wins', () => {
  it('picks the most recently issued plan, wherever it sits in the table', () => {
    const [r] = rowsFor({
      plans: [
        plan({ id: 'p2', level: 28, issuedAt: '2026-08-28T09:00:00', createdAt: '2026-08-28T09:00:00' }),
        plan({ id: 'p1', level: 29, issuedAt: '2026-07-01T09:00:00', createdAt: '2026-07-01T09:00:00' }),
      ],
    });
    expect(r.plan?.id).toBe('p2');
    expect(r.daysHeld).toBe(4);
    expect(r.late).toBe(false);
  });

  it('flags the sheet held past 35 days — §4.9', () => {
    const [r] = rowsFor({ plans: [plan({ issuedAt: '2026-07-01T09:00:00' })] });
    expect(r.daysHeld).toBe(62);
    expect(r.late).toBe(true);
  });

  it('a student with no plan has no days held and is not late', () => {
    const [r] = rowsFor({});
    expect(r.plan).toBeNull();
    expect(r.daysHeld).toBeNull();
    expect(r.late).toBe(false);
  });
});

describe('the two «آخر اختبار» columns — §6.10', () => {
  it('splits the association exam from the internal ones', () => {
    const [r] = rowsFor({
      exams: [
        exam({ id: 'e1', type: 'BADGE_GOLDEN', takenOn: '2026-08-10' }),
        exam({ id: 'e2', type: 'ASSOCIATION', takenOn: '2026-08-05' }),
        exam({ id: 'e3', type: 'BADGE_DIAMOND', takenOn: '2026-08-20' }),
      ],
    });
    expect(r.lastAssociation?.id).toBe('e2');
    expect(r.lastInternal?.id).toBe('e3');
    expect(r.lastExamAt).toBe('2026-08-20');
  });

  it('breaks a same-day tie by entry time, like the exam log', () => {
    const [r] = rowsFor({
      exams: [
        exam({ id: 'e1', takenOn: '2026-08-20', createdAt: '2026-08-20T09:00:00' }),
        exam({ id: 'e2', takenOn: '2026-08-20', createdAt: '2026-08-20T11:00:00' }),
      ],
    });
    expect(r.lastInternal?.id).toBe('e2');
  });

  /* «آخر اختبار» has ONE definition — the printed halaqa report reads this
     field instead of re-deriving, so paper and screen cannot disagree. */
  it('exposes the last exam itself, ties broken by entry time across kinds', () => {
    const [r] = rowsFor({
      exams: [
        exam({ id: 'a1', type: 'ASSOCIATION', takenOn: '2026-08-20', createdAt: '2026-08-20T09:00:00' }),
        exam({ id: 'e1', type: 'BADGE_DIAMOND', takenOn: '2026-08-20', createdAt: '2026-08-20T11:00:00' }),
      ],
    });
    expect(r.lastExam?.id).toBe('e1');
    expect(r.lastExamAt).toBe('2026-08-20');
  });
});

describe('«لم يُختبر مؤخرًا» — §6.1', () => {
  it('flags silence past the threshold, and a student never examined at all', () => {
    expect(rowsFor({ exams: [exam({ takenOn: '2026-07-01' })] })[0].examOverdue).toBe(true);
    expect(rowsFor({ exams: [exam({ takenOn: '2026-08-25' })] })[0].examOverdue).toBe(false);
    expect(rowsFor({})[0].examOverdue).toBe(true);
  });

  it('never flags Talqeen — silence is his normal state, §4.11', () => {
    const [r] = rowsFor({ students: [student({ track: 'TALQEEN', currentLevel: null })] });
    expect(r.examOverdue).toBe(false);
  });

  /* §4.11 exempts TALQEEN alone. A student whose track column arrived empty is
     exactly the forgotten student this list exists to surface. */
  it('flags a student imported with no track at all', () => {
    const [r] = rowsFor({ students: [student({ track: null, currentLevel: null })] });
    expect(r.examOverdue).toBe(true);
  });

  it('never flags an inactive student — he is not being followed', () => {
    const [r] = rowsFor({ students: [student({ status: 'INACTIVE' })] });
    expect(r.examOverdue).toBe(false);
  });
});

describe('the four lists have one definition — §6.10', () => {
  const many = () => followUpRows({
    students: [
      student({ id: 's1', fullName: 'أحمد', currentLevel: 29 }),
      student({ id: 's2', fullName: 'خالد', track: 'SILVER', currentLevel: 57 }),
      student({ id: 's3', fullName: 'فهد', status: 'INACTIVE' }),
      student({ id: 's4', fullName: 'عمر', track: 'TALQEEN', currentLevel: null }),
    ],
    plans: [plan({ id: 'p2', studentId: 's2', track: 'SILVER', level: 57, issuedAt: '2026-07-01T09:00:00' })],
    exams: [exam({ id: 'e1', studentId: 's1', type: 'BADGE_DIAMOND', ajza: 2 })],
    txns: [txn({ id: 't1', studentId: 's1', delta: 300 }), txn({ id: 't2', studentId: 's2', delta: 120 })],
  }, NOW);

  it('scopes to the active students first', () => {
    expect(followedRows(many()).map((r) => r.student.id)).toEqual(['s1', 's2', 's4']);
  });

  it('filters and orders each list by its own rule', () => {
    const rows = followedRows(many());
    expect(listRows(rows, 'ready').map((r) => r.student.id)).toEqual(['s1']);
    expect(listRows(rows, 'late').map((r) => r.student.id)).toEqual(['s2']);
    // s2 examined never; s1 examined recently; talqeen absent
    expect(listRows(rows, 'unexamined').map((r) => r.student.id)).toEqual(['s2']);
    // top: by balance desc, capped at the honour board's size
    expect(listRows(rows, 'top').map((r) => r.student.id)).toEqual(['s1', 's2']);
    expect(TOP_LIST_SIZE).toBe(10);
  });

  it('counts are the lists’ own lengths, nothing separate to drift', () => {
    const rows = followedRows(many());
    expect(listCounts(rows)).toEqual({ ready: 1, late: 1, overdue: 1, top: 2 });
  });
});

describe('readiness and balance ride along', () => {
  it('computes §4.8 from the roster level and the whole exam history', () => {
    // golden 29 ⇒ 2 juz; diamond passed on juz 2 and the association silent
    const [r] = rowsFor({ exams: [exam({ type: 'BADGE_DIAMOND', ajza: 2 })] });
    expect(r.ready).toEqual({ ready: true, ajza: 2, reason: null });
  });

  it('sums the ledger per student, not per screen', () => {
    const [r] = rowsFor({ txns: [txn({ delta: 50 }), txn({ id: 't2', delta: -20 })] });
    expect(r.balance).toBe(30);
  });
});
