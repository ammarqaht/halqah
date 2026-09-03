/* The follow-up view — SPEC.md §6.10 (إد-٥-د).
   This is the client's «البحث بالحلقة» and «البحث باسم الطالب» sheets, made
   live. Every figure below is derived; nothing is stored twice. */
import type { Student, Halaqa, Exam, StudentPlan, PointTxn } from './types';
import { readyForAssociation, ajzaForLevel } from './exams';
import { balances } from './points';

export const LATE_AFTER_DAYS = 35;
export const STALE_EXAM_DAYS = 60;

const daysSince = (iso: string | null | undefined) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

export type FollowRow = {
  student: Student;
  halaqa: Halaqa | null;
  plan: StudentPlan | null;
  /** Days since the sheet was printed — what «تأخّر في مستواه» measures. */
  daysOnLevel: number | null;
  isLate: boolean;
  ajza: number | null;
  lastAssociation: Exam | null;
  lastInternal: Exam | null;
  daysSinceExam: number | null;
  examStale: boolean;
  ready: boolean;
  readyReason: string | null;
  balance: number;
  examCount: number;
  passedCount: number;
};

export function buildRows(db: {
  students: Student[]; halaqat: Halaqa[]; exams: Exam[];
  plans: StudentPlan[]; txns: PointTxn[];
}): FollowRow[] {
  const halaqaById = new Map(db.halaqat.map((h) => [h.id, h]));
  const bal = balances(db.txns);

  const examsByStudent = new Map<string, Exam[]>();
  for (const e of db.exams) {
    const list = examsByStudent.get(e.studentId) ?? [];
    list.push(e);
    examsByStudent.set(e.studentId, list);
  }

  const planByStudent = new Map<string, StudentPlan>();
  for (const p of [...db.plans].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))) {
    planByStudent.set(p.studentId, p);   // the latest wins
  }

  return db.students.map((student) => {
    const exams = (examsByStudent.get(student.id) ?? [])
      .sort((a, b) => b.takenOn.localeCompare(a.takenOn));
    const plan = planByStudent.get(student.id) ?? null;
    const days = daysSince(plan?.issuedAt);
    const lastAny = exams[0] ?? null;
    const sinceExam = daysSince(lastAny?.takenOn);

    const r = readyForAssociation({
      track: student.track,
      level: plan?.level ?? student.currentLevel ?? null,
      exams,
    });

    return {
      student,
      halaqa: student.halaqaId ? halaqaById.get(student.halaqaId) ?? null : null,
      plan,
      daysOnLevel: days,
      isLate: days !== null && days > LATE_AFTER_DAYS,
      ajza: ajzaForLevel(student.track, plan?.level ?? student.currentLevel ?? null),
      lastAssociation: exams.find((e) => e.type === 'ASSOCIATION') ?? null,
      lastInternal: exams.find((e) => e.type === 'BADGE_GOLDEN' || e.type === 'BADGE_DIAMOND') ?? null,
      daysSinceExam: sinceExam,
      /* Talqeen students sit no badge exams, so "not examined lately" is not a
         finding for them — it is the arrangement. */
      examStale: student.track !== 'TALQEEN'
        && (sinceExam === null || sinceExam > STALE_EXAM_DAYS),
      ready: r.ready,
      readyReason: r.ready ? null : r.reason ?? null,
      balance: bal.get(student.id)?.balance ?? 0,
      examCount: exams.length,
      passedCount: exams.filter((e) => e.passed).length,
    };
  });
}

export type ListKind = 'all' | 'ready' | 'late' | 'stale' | 'top';

export const LIST_AR: Record<ListKind, string> = {
  all: 'كل الطلاب',
  ready: 'جاهزون لاختبار الجمعية',
  late: 'متأخّرون على مستواهم',
  stale: 'لم يُختبروا منذ مدّة',
  top: 'الأكثر تقدّمًا',
};

export function applyList(rows: FollowRow[], kind: ListKind): FollowRow[] {
  switch (kind) {
    case 'ready': return rows.filter((r) => r.ready);
    case 'late':  return rows.filter((r) => r.isLate);
    case 'stale': return rows.filter((r) => r.examStale);
    case 'top':   return [...rows]
      .filter((r) => r.passedCount > 0)
      .sort((a, b) => b.passedCount - a.passedCount || (b.ajza ?? 0) - (a.ajza ?? 0))
      .slice(0, 20);
    default: return rows;
  }
}
