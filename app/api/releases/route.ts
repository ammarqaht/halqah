import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession, readStudentSession, readTeacherSession } from '@/lib/auth';
import { RELEASES, type Audience } from '@/content/releases';

/* ما الجديد — which updates this person has already seen.

   The portal says which hat it is wearing (`?for=`), because one browser can
   hold all three cookies — the developer's does — and «seen as a teacher» is
   not «seen as the supervisor». Each is answered from its own session only.

   `since` is when the account was made: an update older than the person is not
   news to them. */

const AUDIENCES: Audience[] = ['admin', 'teacher', 'student'];

async function who(audience: Audience): Promise<{ id: string; since: Date | null } | null> {
  try { return await whoFrom(audience); }
  catch {
    /* The database is unreachable. The session is still good — it is a signed
       token — so answer for it without the account's age. */
    const s = audience === 'admin' ? await readSession()
      : audience === 'teacher' ? await readTeacherSession() : await readStudentSession();
    return s ? { id: s.sub, since: null } : null;
  }
}

async function whoFrom(audience: Audience): Promise<{ id: string; since: Date | null } | null> {
  if (audience === 'admin') {
    const s = await readSession();
    if (!s) return null;
    const u = await db.adminUser.findUnique({ where: { id: s.sub }, select: { createdAt: true } });
    return { id: s.sub, since: u?.createdAt ?? null };
  }
  if (audience === 'teacher') {
    const s = await readTeacherSession();
    if (!s) return null;
    const t = await db.teacher.findUnique({ where: { id: s.sub }, select: { createdAt: true } });
    return { id: s.sub, since: t?.createdAt ?? null };
  }
  const s = await readStudentSession();
  if (!s) return null;
  const c = await db.studentCredential.findUnique({
    where: { studentId: s.sub }, select: { createdAt: true } });
  return { id: s.sub, since: c?.createdAt ?? null };
}

const audienceOf = (v: unknown): Audience | null =>
  AUDIENCES.includes(v as Audience) ? (v as Audience) : null;

export async function GET(req: Request) {
  const audience = audienceOf(new URL(req.url).searchParams.get('for'));
  if (!audience) return NextResponse.json({ error: 'for?' }, { status: 400 });
  const me = await who(audience);
  if (!me) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  try {
    const rows = await db.releaseView.findMany({
      where: { audience, userId: me.id }, select: { releaseId: true } });
    return NextResponse.json({
      seen: rows.map((r) => r.releaseId),
      since: me.since ? me.since.toISOString().slice(0, 10) : null,
    });
  } catch {
    /* The table not there yet (a deploy mid-migration) must not take the
       portal down — the browser falls back to what it remembers itself. */
    return NextResponse.json({ seen: [], since: null, degraded: true });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const audience = audienceOf(body.for);
  if (!audience) return NextResponse.json({ error: 'for?' }, { status: 400 });
  const me = await who(audience);
  if (!me) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const known = new Set(RELEASES.map((r) => r.id));
  const ids = (Array.isArray(body.ids) ? body.ids : [])
    .map(String).filter((id: string) => known.has(id));
  if (!ids.length) return NextResponse.json({ ok: true });

  try {
    await db.releaseView.createMany({
      data: ids.map((releaseId: string) => ({ audience, userId: me.id, releaseId })),
      skipDuplicates: true,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
