import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { bumpRev } from '@/lib/rev';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { dailyAmountFor, dayCountFor, DEFAULT_EXAM_DAYS } from '@/lib/curriculum';
import { badgeAt } from '@/lib/teacher';
import { levelsFor, TRACK_AR, type CurriculumDay, type Track } from '@/lib/types';

/* تعديل مستوى الطالب — one door, and it moves him everywhere at once.

   «ممكن تكون طريقة التعديل لمستواه وخطته تثبت وتتغير عند الطالب وبالنظام
   والمعلم وكل شي» (client, 2 Oct 2026).

   A boy's level lived in three places that were set by three different acts:
   `students.current_level` (the roster, set by hand on his profile), his newest
   `student_plans` row (set by printing a sheet), and `student_progress.level`
   (the teacher's pointer). The portals read them in different orders — the
   teacher's card takes progress first, the boy's page takes current_level — so
   changing the number on the profile moved him on one screen and left him
   where he was on the other two.

   So this writes all three in ONE transaction:
     · the roster's level,
     · the plan for that level — issued if he never had one, and re-dated to
       today if he did, because «newest plan» is how every portal finds his
       sheet and an old date would leave the previous sheet on top,
     · his pointer — on that level, at مقرّر 1, the start of a new sheet.

   The browser store then adopts the same rows (same plan id), so the next
   ordinary save carries them rather than erasing them. */

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = String(body.studentId ?? '');
  const level = Math.trunc(Number(body.level));

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: 'لم يُعثر على الطالب.' }, { status: 404 });

  /* The track the supervisor is looking at. His page may hold a track this
     database has not received yet — set a minute ago, still in the save queue —
     and refusing him «تلقين» while his screen says «فضي» is the error he got
     (client, 5 Oct 2026). A silver or golden track sent with the request is
     taken, and written, since the level only means something on it. */
  const sent = body.track === 'SILVER' || body.track === 'GOLDEN' ? body.track as Track : null;
  const track = sent ?? (student.track as Track | null);
  if (!track) {
    return NextResponse.json(
      { error: 'هذا الطالب بلا مسار — حدّد مساره (فضي أو ذهبي) من ملفه أولًا.' }, { status: 422 });
  }
  if (track === 'TALQEEN') {
    return NextResponse.json(
      { error: 'مسار التلقين بلا مستوى — المستوى للمسارين الفضي والذهبي.' }, { status: 422 });
  }
  if (!levelsFor(track).includes(level)) {
    return NextResponse.json(
      { error: `لا مستوى ${level} في المسار ${TRACK_AR[track]}.` }, { status: 422 });
  }

  const curriculum = await db.curriculumDay.findMany({ where: { track, level } });
  if (!curriculum.length) {
    return NextResponse.json(
      { error: `المستوى ${level} (${TRACK_AR[track]}) غير موجود في «منهج الحفظ» — ارفعه أولًا.` },
      { status: 422 });
  }

  const now = new Date().toISOString();
  const dayCount = dayCountFor(track, level, curriculum as unknown as CurriculumDay[]);
  const before = {
    currentLevel: student.currentLevel,
    progress: await db.studentProgress.findUnique({ where: { studentId } }),
  };

  const plan = await db.$transaction(async (tx) => {
    await tx.student.update({ where: { id: studentId }, data: { currentLevel: level, track } });

    const existing = await tx.studentPlan.findUnique({
      where: { studentId_track_level: { studentId, track, level } } });
    const plan = existing
      ? await tx.studentPlan.update({
          where: { id: existing.id }, data: { issuedAt: now, issuedBy: s.name } })
      : await tx.studentPlan.create({ data: {
          id: randomUUID(), studentId, track, level,
          issuedAt: now, issuedBy: s.name, dayCount,
          examDays: { ...DEFAULT_EXAM_DAYS }, dailyAmount: dailyAmountFor(track),
          printedCount: 0,
        } });

    const examDays = (plan.examDays as { BADGE_GOLDEN?: number; BADGE_DIAMOND?: number } | null)
      ?? DEFAULT_EXAM_DAYS;
    const pointer = {
      track, level, assignmentNo: 1, awaitingExam: badgeAt(1, examDays),
      setById: s.sub, setByRole: 'SUPERVISOR', setByName: s.name,
    };
    await tx.studentProgress.upsert({
      where: { studentId },
      create: { studentId, ...pointer },
      update: pointer,
    });

    await tx.auditLog.create({ data: {
      actorId: s.sub, action: 'SET_LEVEL', entity: 'student', entityId: studentId,
      before: JSON.parse(JSON.stringify(before)) as object,
      after: { currentLevel: level, planId: plan.id, assignmentNo: 1 } as object,
    } });

    /* The supervisor's other open pages still hold the old level and no plan;
       one of them saving would undo all of this — lib/rev. */
    await bumpRev(tx);

    return plan;
  });

  return NextResponse.json({
    ok: true,
    plan: { ...plan, createdAt: plan.createdAt.toISOString() },
  });
}
