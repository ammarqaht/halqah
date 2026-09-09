import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { scoreMax } from '@/lib/exams';

/** My exams, newest first. */
export async function GET() {
  const g = await scope();
  if (!g.ok) return g.res;

  const exams = await db.exam.findMany({
    where: { studentId: g.s.sub },
    orderBy: [{ takenOn: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({
    exams: exams.map((e) => ({
      id: e.id, type: e.type,
      typeAr: EXAM_TYPE_AR[e.type as ExamType] ?? e.type,
      takenOn: e.takenOn, level: e.level, ajza: e.ajza,
      score: e.score, scoreMax: scoreMax(e.type), passed: e.passed,
      tajweedTopics: e.tajweedTopics, source: e.source,
    })),
  });
}
