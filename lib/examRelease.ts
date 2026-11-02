import 'server-only';
import { db } from '@/lib/db';
import { dayCountFor, DEFAULT_EXAM_DAYS } from '@/lib/curriculum';
import { badgeAt } from '@/lib/teacher';
import type { CurriculumDay, ExamDayMap, Track } from '@/lib/types';

/* اجتاز وسامه — فينتقل إلى المقرّر الذي بعده.

   «إذا اختبر الطالب واجتاز ينتقل في النظام تلقائيًا من مقرّر ١٢ إلى مقرّر ١٣،
   أو من أي مقرّر إلى المقرّر الذي بعده» (client, 2 Nov 2026).

   The pointer stops ON a badge مقرّر and waits — «ويبقى الطالب على مقرّره حتى
   تُسجَّل نتيجته» — and until now nothing let it go: a boy who passed his golden
   badge stayed on ١٢ until the supervisor moved him by hand. This is the hand.

   Released only by the exam it waits for: a PASSED exam of the same badge, on
   the same level (or, for an exam saved without a level, taken no earlier than
   the day he reached the stop — an old golden badge from last level must not
   open this one). A badge on the level's LAST مقرّر is the end of the level,
   and the level is moved by the supervisor (اعتماد المستوى), so it is left
   standing: clearing it there would only stop him again on the next save.

   Never un-released: a pass later edited to a fail leaves him where he moved
   to, and the supervisor sets the مقرّر by hand if that was a mistake.

   Idempotent and cheap: one read of the boys who are waiting, and a write only
   for those whose exam has come. Run after the supervisor saves (where exams
   are written) and before a teacher's register is built. */
/** The same, never throwing — every caller runs it beside a job that matters
    more — but saying so in the log when it fails. */
export const releaseQuietly = (ids?: string[]) =>
  releasePassedBadges(ids).catch((e) => { console.error('releasePassedBadges', e); return 0; });

export async function releasePassedBadges(studentIds?: string[]): Promise<number> {
  const waiting = await db.studentProgress.findMany({
    where: {
      awaitingExam: { not: null },
      assignmentNo: { not: null },
      ...(studentIds ? { studentId: { in: studentIds } } : {}),
    },
    include: { student: { select: { plans: { orderBy: { issuedAt: 'desc' }, take: 1 } } } },
  });
  if (!waiting.length) return 0;

  const exams = await db.exam.findMany({
    where: {
      studentId: { in: waiting.map((w) => w.studentId) },
      passed: true,
      type: { in: ['BADGE_GOLDEN', 'BADGE_DIAMOND'] },
    },
    select: { studentId: true, type: true, level: true, takenOn: true },
  });
  if (!exams.length) return 0;

  const pairs = [...new Set(waiting.filter((w) => w.track && w.level != null)
    .map((w) => `${w.track}:${w.level}`))];
  const curriculum = pairs.length
    ? await db.curriculumDay.findMany({
        where: { OR: pairs.map((p) => { const [track, level] = p.split(':'); return { track, level: Number(level) }; }) },
        select: { track: true, level: true, dayNo: true },
      })
    : [];

  /* The day he REACHED the stop: the afternoon he recited the مقرّر before it
     on this level. Not the pointer row's updatedAt — every save of his card
     touches that, and an exam taken before his latest card would never count. */
  const reachingDays = await db.dayEntry.findMany({
    where: { studentId: { in: waiting.map((w) => w.studentId) }, assignmentNo: { not: null } },
    select: { studentId: true, assignmentNo: true, level: true, day: true },
  });
  const reachedOf = (w: (typeof waiting)[number]) => {
    const days = reachingDays
      .filter((e) => e.studentId === w.studentId && e.level === w.level && e.assignmentNo === (w.assignmentNo ?? 0) - 1)
      .map((e) => e.day).sort();
    return days[0] ?? w.updatedAt.toISOString().slice(0, 10);
  };

  let released = 0;
  for (const w of waiting) {
    const reachedOn = reachedOf(w);
    const passed = exams.some((e) => e.studentId === w.studentId && e.type === w.awaitingExam
      && (e.level != null ? e.level === w.level : e.takenOn >= reachedOn));
    if (!passed || w.assignmentNo == null || !w.track || w.level == null) continue;

    const dayCount = dayCountFor(w.track as Track, w.level, curriculum as unknown as CurriculumDay[]);
    if (w.assignmentNo >= dayCount) continue;            // the level's end — see above

    const plan = w.student.plans[0];
    const examDays = (plan?.examDays as unknown as ExamDayMap | null) ?? DEFAULT_EXAM_DAYS;
    const next = w.assignmentNo + 1;
    /* Only if he is still exactly where he was read: a supervisor or a teacher
       who moved him in the meantime wins, and this does nothing. */
    const r = await db.studentProgress.updateMany({
      where: { studentId: w.studentId, assignmentNo: w.assignmentNo, awaitingExam: w.awaitingExam },
      data: {
        assignmentNo: next,
        awaitingExam: badgeAt(next, examDays),
        setById: null, setByRole: 'SYSTEM', setByName: 'اجتاز الاختبار',
      },
    });
    released += r.count;
  }
  return released;
}
