import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { toHalaqa } from '@/lib/serialize';

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const h = await req.json();
  if (!h?.teacher?.trim()) return NextResponse.json({ error: 'اسم المعلّم مطلوب' }, { status: 400 });

  const name = String(h.name || '').trim()
    || `تحفيظ ${String(h.teacher).trim()} (${h.timeSlot || 'العصر'})`;

  const data = {
    id: h.id,
    name,
    teacher: String(h.teacher).trim(),
    mosque: h.mosque || 'جامع محمد العبدالكريم — حي أُحد',
    timeSlot: h.timeSlot || 'العصر',
    track: h.track || null,
    notes: h.notes || null,
  };

  try {
    const saved = await db.halaqa.upsert({
      where: { id: data.id }, create: data, update: { ...data, id: undefined },
    });

    /* A halaqa runs one track, so it can be carried to its members at once. */
    if (h.applyTrackToStudents && data.track) {
      await db.student.updateMany({ where: { halaqaId: saved.id }, data: { track: data.track } });
    }

    await db.auditLog.create({
      data: { actorId: session.sub, action: 'UPSERT_HALAQA', entity: 'halaqa',
              entityId: saved.id, after: JSON.parse(JSON.stringify(saved)) as object },
    });
    return NextResponse.json(toHalaqa(saved));
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر الحفظ', detail: e instanceof Error ? e.message.split('\n')[0] : '' },
      { status: 500 });
  }
}

/** Deleting a halaqa detaches its students; it never deletes a student. */
export async function DELETE(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 400 });

  try {
    const n = await db.student.count({ where: { halaqaId: id } });
    await db.$transaction([
      db.student.updateMany({ where: { halaqaId: id }, data: { halaqaId: null } }),
      db.halaqa.delete({ where: { id } }),
    ]);
    await db.auditLog.create({
      data: { actorId: session.sub, action: 'DELETE_HALAQA', entity: 'halaqa', entityId: id,
              before: { detachedStudents: n } },
    });
    return NextResponse.json({ ok: true, detached: n });
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر الحذف', detail: e instanceof Error ? e.message.split('\n')[0] : '' },
      { status: 500 });
  }
}
