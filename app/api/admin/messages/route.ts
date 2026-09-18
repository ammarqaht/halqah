import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { TRACK_AR, type Track } from '@/lib/types';

/* رسائل الإدارة — «إشعار من الإدارة يكتبه المشرف ويظهر للمعلمين» (§مع-٢), and
   since 18 Sep 2026 للطلاب كذلك: «ويمكن يرسل رسائل للطلاب والمعلمين».

   TO WHOM — four ways for the students, two for the teachers: «كل الطلاب،
   بالحلقة، بالمسار، طلاب بعينهم» (client, 18 Sep 2026). The first three are
   asked for as a SET rather than ticked one by one, because «إلى حلقة هشام» is
   one decision and thirteen ticks are thirteen chances to miss one. The set is
   resolved HERE and not in the browser, so it means the halaqa as the database
   has it at the moment of sending rather than as some screen last loaded it.
   By halaqa that set may be SEVERAL halaqat — one send, one card, one
   withdrawal, rather than the same words written twice.

   ADDRESSING IS A ROW PER READER, not a list inside one row. Each reader's route
   filters on his own id, and the read-marker is keyed `MESSAGE:<id>` — so one
   shared row would mean the first reader ticked it off for everybody. `groupId`
   puts the rows back together for the supervisor who wrote them, and
   `scopeLabel` records how they were chosen: a boy who has since left a halaqa
   would otherwise make an old send describe itself wrongly.

   Sending to EVERYONE of an audience stays ONE row with no id on it at all,
   because it is one announcement and a hundred identical rows would be a hundred
   rows to withdraw.

   `audience` is a COLUMN and not an inference from which id is set: a broadcast
   has neither, and «to everyone» must still say to everyone of WHICH kind. A
   teachers' announcement landing on a child's screen is the one mistake this
   table must make impossible. */

const guard = async () => readSession();

const MAX_BODY = 500;

/** How many names a card shows before «عرض الكل» takes the rest. */
const NAMES_ON_CARD = 6;

export async function GET() {
  const s = await guard();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const [teachers, students, halaqat, messages] = await Promise.all([
    db.teacher.findMany({
      where: { active: true },
      orderBy: { username: 'asc' },
      include: { halaqa: { select: { id: true, name: true } } },
    }),
    db.student.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, halaqaId: true, track: true },
    }),
    db.halaqa.findMany({ orderBy: { name: 'asc' },
      select: { id: true, name: true, teacher: true } }),
    db.adminMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }),
  ]);

  const halaqaName = new Map(halaqat.map((h) => [h.id, h.name || h.teacher]));
  const teacherName = new Map(teachers.map((t) => [t.id, t.fullName]));
  const studentName = new Map(students.map((x) => [x.id, x.fullName]));

  const keys = messages.map((m) => `MESSAGE:${m.id}`);
  const [tReads, sReads] = await Promise.all([
    db.teacherAlertRead.findMany({ where: { key: { in: keys } }, select: { key: true } }),
    db.studentAlertRead.findMany({ where: { key: { in: keys } }, select: { key: true } }),
  ]);
  const wasRead = new Set([...tReads, ...sReads].map((r) => r.key));

  /* One card per SEND — «كل رسالة في بطاقة وحدة ومعها لمن أُرسلت». Rows written
     before `groupId` existed stand alone, which is what they were. */
  type Card = {
    id: string; body: string; audience: string; scopeLabel: string;
    names: string[]; sent: number; read: number; byName: string; at: string;
  };
  const byGroup = new Map<string, Card>();
  for (const m of messages) {
    const key = m.groupId ?? m.id;
    const card = byGroup.get(key) ?? {
      id: key, body: m.body, audience: m.audience, scopeLabel: m.scopeLabel,
      names: [], sent: 0, read: 0,
      byName: m.createdByName, at: m.createdAt.toISOString(),
    };
    card.sent += 1;
    if (wasRead.has(`MESSAGE:${m.id}`)) card.read += 1;
    const who = m.teacherId ? teacherName.get(m.teacherId)
      : m.studentId ? studentName.get(m.studentId) : null;
    if (who) card.names.push(who);
    byGroup.set(key, card);
  }

  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id, fullName: t.fullName, username: t.username,
      halaqa: t.halaqa?.name ?? null,
    })),
    students: students.map((x) => ({
      id: x.id,
      fullName: x.fullName,
      halaqaId: x.halaqaId,
      halaqa: x.halaqaId ? (halaqaName.get(x.halaqaId) ?? null) : null,
      track: x.track,
      trackAr: x.track ? TRACK_AR[x.track as Track] : null,
    })),
    halaqat: halaqat.map((h) => ({ id: h.id, name: h.name || h.teacher })),
    messages: [...byGroup.values()].slice(0, 40).map((c) => ({
      id: c.id, body: c.body, audience: c.audience, scopeLabel: c.scopeLabel,
      sent: c.sent, read: c.read, byName: c.byName, at: c.at,
      names: c.names.slice(0, NAMES_ON_CARD),
      more: Math.max(0, c.names.length - NAMES_ON_CARD),
      allNames: c.names,
    })),
  });
}

export async function POST(req: Request) {
  const s = await guard();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const body = String(raw.body ?? '').trim().slice(0, MAX_BODY);
  if (!body) return NextResponse.json({ error: 'اكتب نص الرسالة.' }, { status: 400 });

  const audience = raw.audience === 'STUDENTS' ? 'STUDENTS' : 'TEACHERS';
  const scope = ['ALL', 'HALAQA', 'TRACK', 'PICK'].includes(String(raw.scope))
    ? String(raw.scope) as 'ALL' | 'HALAQA' | 'TRACK' | 'PICK'
    : 'PICK';

  const ids: string[] = Array.isArray(raw.ids)
    ? [...new Set((raw.ids as unknown[])
        .map((x) => String(x ?? ''))
        .filter((x): x is string => x.length > 0))]
    : [];

  const by = { createdById: s.sub, createdByName: s.name ?? '' };

  /* «إلى الجميع» is a scope a supervisor chooses, never what happens because he
     ticked nobody: a message that went to a hundred and seventeen students
     because the list was empty is the one mistake this screen must not make. */
  if (scope === 'ALL') {
    const m = await db.adminMessage.create({
      data: {
        body, audience, ...by,
        scopeLabel: audience === 'STUDENTS' ? 'كل الطلاب' : 'كل المعلمين',
      },
    });
    return NextResponse.json({ ok: true, sent: 1, all: true, id: m.id });
  }

  if (audience === 'TEACHERS') {
    if (!ids.length) {
      return NextResponse.json({ error: 'اختر معلمًا واحدًا على الأقل، أو أرسلها للجميع.' }, { status: 400 });
    }
    const live = await db.teacher.findMany({
      where: { id: { in: ids }, active: true }, select: { id: true } });
    if (!live.length) {
      return NextResponse.json({ error: 'لم يُعثر على معلمين بهذه الأسماء.' }, { status: 400 });
    }
    const groupId = randomUUID();
    await db.adminMessage.createMany({
      data: live.map((t) => ({
        body, audience, teacherId: t.id, groupId,
        scopeLabel: live.length === 1 ? 'معلم بعينه' : 'معلمون بأعيانهم', ...by,
      })),
    });
    return NextResponse.json({ ok: true, sent: live.length, all: false });
  }

  /* ── الطلاب: بالحلقة، أو بالمسار، أو بأعيانهم ─────────────────────────── */
  let where: Record<string, unknown> = { status: 'ACTIVE' };
  let scopeLabel = '';

  if (scope === 'HALAQA') {
    /* «يمكن الاختيار من متعدد» (client, 18 Sep 2026). One halaqa stays one
       halaqa — an older screen sending `halaqaId` still works — and two are one
       send rather than two, which is what the card above them now shows. */
    const wanted = Array.isArray(raw.halaqaIds)
      ? [...new Set((raw.halaqaIds as unknown[]).map((x) => String(x ?? '')).filter(Boolean))]
      : [String(raw.halaqaId ?? '')].filter(Boolean);
    const hs = wanted.length
      ? await db.halaqa.findMany({
          where: { id: { in: wanted } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, teacher: true } })
      : [];
    if (!hs.length) return NextResponse.json({ error: 'اختر الحلقة.' }, { status: 400 });
    where = { ...where, halaqaId: { in: hs.map((h) => h.id) } };
    const names = hs.map((h) => h.name || h.teacher);
    /* The label is what the card will say months from now, so it names them
       while they are few and counts them once they are many. */
    scopeLabel = names.length === 1 ? names[0]
      : names.length <= 3 ? names.join(' · ')
      : `${names.length} حلقات`;
  } else if (scope === 'TRACK') {
    const track = String(raw.track ?? '');
    if (!['SILVER', 'GOLDEN', 'TALQEEN'].includes(track)) {
      return NextResponse.json({ error: 'اختر المسار.' }, { status: 400 });
    }
    where = { ...where, track };
    scopeLabel = `المسار ${TRACK_AR[track as Track]}`;
  } else {
    if (!ids.length) {
      return NextResponse.json({ error: 'اختر طالبًا واحدًا على الأقل، أو أرسلها للجميع.' }, { status: 400 });
    }
    where = { ...where, id: { in: ids } };
    scopeLabel = ids.length === 1 ? 'طالب بعينه' : 'طلاب بأعيانهم';
  }

  const live = await db.student.findMany({ where, select: { id: true } });
  if (!live.length) {
    return NextResponse.json({ error: 'لا طلاب في هذا النطاق.' }, { status: 400 });
  }

  const groupId = randomUUID();
  await db.adminMessage.createMany({
    data: live.map((x) => ({
      body, audience, studentId: x.id, groupId, scopeLabel, ...by,
    })),
  });

  return NextResponse.json({ ok: true, sent: live.length, all: false, scopeLabel });
}

/** Withdraw a whole SEND — every row it wrote, and their read-markers with them,
    so re-sending it later is a fresh unread alert rather than one already ticked. */
export async function DELETE(req: Request) {
  const s = await guard();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'لم تُحدَّد الرسالة.' }, { status: 400 });

  /* The id on a card is its group's — or its own, for a row written before
     groups existed. Both are covered without asking which it is. */
  const rows = await db.adminMessage.findMany({
    where: { OR: [{ id }, { groupId: id }] }, select: { id: true } });
  if (!rows.length) return NextResponse.json({ ok: true, removed: 0 });

  await db.adminMessage.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  const keys = rows.map((r) => `MESSAGE:${r.id}`);
  await db.teacherAlertRead.deleteMany({ where: { key: { in: keys } } });
  await db.studentAlertRead.deleteMany({ where: { key: { in: keys } } });

  return NextResponse.json({ ok: true, removed: rows.length });
}
