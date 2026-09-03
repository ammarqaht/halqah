import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { toStudent } from '@/lib/serialize';
import type { Prisma } from '@prisma/client';

/** Create or update one student. Every change is written to the audit log. */
export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const s = await req.json();
  if (!s?.fullName?.trim()) {
    return NextResponse.json({ error: 'اسم الطالب مطلوب' }, { status: 400 });
  }

  const data: Prisma.StudentUncheckedCreateInput = {
    id: s.id,
    fullName: String(s.fullName).trim(),
    nationalId: s.nationalId || null,
    nationalIdFlag: s.nationalIdFlag || null,
    dedupeKey: s.dedupeKey || s.nationalId || null,
    track: s.track || null,
    halaqaId: s.halaqaId || null,
    grade: s.grade ?? '',
    stage: s.stage ?? '',
    nationality: s.nationality ?? '',
    guardianPhone: s.guardianPhone ?? '',
    status: s.status ?? 'ACTIVE',
    currentLevel: s.currentLevel ?? null,
  };

  try {
    const before = await db.student.findUnique({ where: { id: data.id! } });
    const saved = await db.student.upsert({
      where: { id: data.id! },
      create: data,
      update: { ...data, id: undefined },
    });
    await db.auditLog.create({
      data: {
        actorId: session.sub,
        action: before ? 'UPDATE_STUDENT' : 'CREATE_STUDENT',
        entity: 'student', entityId: saved.id,
        before: before ? (JSON.parse(JSON.stringify(before)) as object) : undefined,
        after: JSON.parse(JSON.stringify(saved)) as object,
      },
    });
    return NextResponse.json(toStudent(saved));
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر الحفظ', detail: e instanceof Error ? e.message.split('\n')[0] : '' },
      { status: 500 });
  }
}

/** Move a selection of students to another halaqa. Their history follows. */
export async function PATCH(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const { ids, halaqaId } = await req.json();
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ error: 'لم يُحدَّد أحد' }, { status: 400 });
  }

  try {
    const before = await db.student.findMany({
      where: { id: { in: ids } }, select: { id: true, halaqaId: true },
    });

    await db.$transaction([
      db.student.updateMany({ where: { id: { in: ids } }, data: { halaqaId: halaqaId || null } }),
      db.halaqaTransfer.createMany({
        data: before.map((b) => ({
          studentId: b.id, fromHalaqaId: b.halaqaId, toHalaqaId: halaqaId || null,
          movedBy: session.sub,
        })),
      }),
    ]);

    return NextResponse.json({ ok: true, moved: ids.length });
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر النقل', detail: e instanceof Error ? e.message.split('\n')[0] : '' },
      { status: 500 });
  }
}
