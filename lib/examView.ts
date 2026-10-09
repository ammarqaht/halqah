/* The shape «نتيجة اختبار، كاملة» (components/ExamSheet) is drawn from — built
   once here so the student's and the teacher's APIs cannot drift apart. */
import type { Exam, ExamQuestion } from '@prisma/client';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { scoreMax } from '@/lib/exams';

export function examView(e: Exam & { questions: ExamQuestion[] }) {
  return {
    id: e.id, type: e.type,
    typeAr: EXAM_TYPE_AR[e.type as ExamType] ?? e.type,
    takenOn: e.takenOn, level: e.level, ajza: e.ajza, examiner: e.examiner,
    score: e.score, scoreMax: scoreMax(e.type), passed: e.passed,
    errors: e.errors, warnings: e.warnings, tajweedErrors: e.tajweedErrors,
    tajweedTopics: e.tajweedTopics, note: e.note, source: e.source,
    pointsAwarded: e.pointsAwarded, pointsPaid: e.pointsPaid,
    questions: [...e.questions].sort((a, b) => a.seq - b.seq).map((q) => ({
      id: q.id, seq: q.seq, surah: q.surah, ayahFrom: q.ayahFrom, ayahTo: q.ayahTo,
      errors: q.errors, warnings: q.warnings, tajweedErrors: q.tajweedErrors, note: q.note,
    })),
  };
}
