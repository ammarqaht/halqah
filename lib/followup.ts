/* Follow-up aggregation — SPEC.md §6.10 (إد-٥-د), the data behind
   «البحث بالحلقة» and the four ready-made lists. Pure functions, no storage,
   no React — the same contract as `lib/exams.ts`, and the shape a follow-up
   SQL view keeps when Prisma lands.

   One pass over each table, whatever the roster size: the non-functional bar in
   SPEC §2 is «no screen issues more than one query per logical list», and its
   in-memory equivalent is that nothing here is O(students × exams).

   The four list DEFINITIONS live here too (`listRows`, `listCounts`) so the
   follow-up screen, the panel, the overview alerts and the printed sheets all
   read one rule — a cap or predicate changed here changes everywhere at once. */
import type { Exam, PointTxn, Student, StudentPlan } from './types';
import { readyForAssociation, isLate, daysSince, examOverdue } from './exams';
import { balances, earnsPoints } from './points';

export type FollowUpRow = {
  student: Student;
  /** The student's current sheet: the latest plan ever issued to him. */
  plan: StudentPlan | null;
  /** «الأيام منذ الإصدار» — how long he has held that sheet. */
  daysHeld: number | null;
  /** §4.9 — strictly more than `LEVEL_LATE_AFTER_DAYS` days on one sheet. */
  late: boolean;
  /** §4.8 — a diamond passed on some juz the association has not examined. */
  ready: ReturnType<typeof readyForAssociation>;
  lastAssociation: Exam | null;
  /** Latest of everything that is not the association's: badges, mock, tajweed. */
  lastInternal: Exam | null;
  /** Latest of any type at all — ties broken by entry time, like the exam log.
      The ONE definition of «آخر اختبار»; derive from it, never re-derive. */
  lastExam: Exam | null;
  /** Its date — what «لم يُختبر مؤخرًا» measures from. */
  lastExamAt: string | null;
  /** §6.1's «not examined in N days». Never true for Talqeen — §4.11 keeps him
      outside the level exams, so silence is his normal state, not an alert.
      A student whose track column arrived EMPTY is still flagged: he is the
      forgotten student this list exists to surface. */
  examOverdue: boolean;
  balance: number;
};

/** `b` when it postdates `a` — ties broken by insertion time, like the exam log. */
const later = (a: Exam | null, b: Exam): Exam =>
  !a || b.takenOn > a.takenOn || (b.takenOn === a.takenOn && b.createdAt > a.createdAt) ? b : a;

export function followUpRows(
  db: { students: Student[]; plans: StudentPlan[]; exams: Exam[]; txns: PointTxn[] },
  now: Date = new Date(),
): FollowUpRow[] {
  const planOf = new Map<string, StudentPlan>();
  for (const p of db.plans) {
    const prev = planOf.get(p.studentId);
    if (!prev || p.issuedAt > prev.issuedAt
      || (p.issuedAt === prev.issuedAt && p.createdAt > prev.createdAt)) {
      planOf.set(p.studentId, p);
    }
  }

  const examsOf = new Map<string, { assoc: Exam | null; internal: Exam | null; all: Exam[] }>();
  for (const e of db.exams) {
    const g = examsOf.get(e.studentId) ?? { assoc: null, internal: null, all: [] };
    if (e.type === 'ASSOCIATION') g.assoc = later(g.assoc, e);
    else g.internal = later(g.internal, e);
    g.all.push(e);
    examsOf.set(e.studentId, g);
  }

  const bal = balances(db.txns);

  return db.students.map((student) => {
    const plan = planOf.get(student.id) ?? null;
    const g = examsOf.get(student.id) ?? { assoc: null, internal: null, all: [] };
    const lastExam = g.internal ? later(g.assoc, g.internal) : g.assoc;
    /* The roster's level is authoritative; a plan can lag behind an advance the
       supervisor recorded on the student himself. */
    const level = student.currentLevel ?? plan?.level ?? null;
    return {
      student,
      plan,
      daysHeld: daysSince(plan?.issuedAt, now),
      late: isLate(plan, now),
      ready: readyForAssociation({ track: student.track, level, exams: g.all }),
      lastAssociation: g.assoc,
      lastInternal: g.internal,
      lastExam,
      lastExamAt: lastExam?.takenOn ?? null,
      examOverdue: student.status === 'ACTIVE' && student.track !== 'TALQEEN'
        && examOverdue(lastExam?.takenOn ?? null, now),
      balance: bal.get(student.id)?.balance ?? 0,
    };
  });
}

/* ── The four ready-made lists — SPEC §6.10 ─────────────────────────────────
   One definition each. Callers pass rows already scoped to what they show
   (active students, one halaqa…); the list only filters and orders. */

export type ListKey = 'ready' | 'late' | 'unexamined' | 'top';

/** «أعلى عشرة» — the honour board's own size, and the top list matches it. */
export const TOP_LIST_SIZE = 10;

/** The students the follow-up screens watch: the active ones. */
export const followedRows = (rows: FollowUpRow[]) =>
  rows.filter((r) => r.student.status === 'ACTIVE');

export function listRows(rows: FollowUpRow[], list: ListKey): FollowUpRow[] {
  switch (list) {
    case 'ready':
      return rows.filter((r) => r.ready.ready);
    case 'late':
      return rows.filter((r) => r.late)
        .sort((a, b) => (b.daysHeld ?? 0) - (a.daysHeld ?? 0));
    case 'unexamined':
      /* Never examined first — the student everyone forgot outranks the one
         merely overdue — then the longest silence. */
      return rows.filter((r) => r.examOverdue)
        .sort((a, b) => (a.lastExamAt ?? '').localeCompare(b.lastExamAt ?? ''));
    case 'top':
      return rows.filter((r) => earnsPoints(r.student) && r.balance > 0)
        .sort((a, b) => b.balance - a.balance
          || a.student.fullName.localeCompare(b.student.fullName, 'ar'))
        .slice(0, TOP_LIST_SIZE);
  }
}

/** The badge figures beside the list names — by construction `listRows().length`. */
export const listCounts = (rows: FollowUpRow[]) => ({
  ready: listRows(rows, 'ready').length,
  late: listRows(rows, 'late').length,
  overdue: listRows(rows, 'unexamined').length,
  top: listRows(rows, 'top').length,
});
