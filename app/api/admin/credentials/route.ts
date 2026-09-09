import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession, hashPin, loginIdFor, LOGIN_ID_FIRST } from '@/lib/auth';

/* حسابات الطلاب.

   Sign-in is a four-digit LOGIN NUMBER and the boy's own NATIONAL ID.

   Nothing is generated and nothing is memorised: the number is sequential from
   1001 so a teacher can read a column of them out, and the password is a thing
   the boy already knows and cannot lose. There is no PIN to print, no PIN to
   forget and no PIN to reset — which is the whole reason the client changed it.

   What this is NOT is a secret. His teacher, his classmates and the roster all
   know his national id. It stops a boy opening another boy's page by guessing a
   number between 1001 and 1117, and the lockout makes even that impractical.
   Nothing behind it is more sensitive than his own level and his own points. */

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const [students, creds, halaqat] = await Promise.all([
    db.student.findMany({ where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' } }),
    db.studentCredential.findMany(),
    db.halaqa.findMany(),
  ]);
  const byStudent = new Map(creds.map((c) => [c.studentId, c]));
  const halaqaName = new Map(halaqat.map((h) => [h.id, h.teacher || h.name]));

  const idCount = new Map<string, number>();
  for (const st of students) {
    if (st.nationalId) idCount.set(st.nationalId, (idCount.get(st.nationalId) ?? 0) + 1);
  }

  return NextResponse.json({
    rows: students.map((st) => {
      const c = byStudent.get(st.id);
      return {
        studentId: st.id,
        fullName: st.fullName,
        halaqa: st.halaqaId ? halaqaName.get(st.halaqaId) ?? null : null,
        halaqaId: st.halaqaId,
        nationalId: st.nationalId,
        username: c?.username ?? null,
        hasAccount: !!c,
        lastLoginAt: c?.lastLoginAt ? c.lastLoginAt.toISOString() : null,
        noNationalId: !st.nationalId,
        /* Two boys under one national id can both sign in — each has his own
           login number, and the shared id is only the password. Flagged
           anyway, because the supervisor should know. */
        sharedNationalId: !!st.nationalId && (idCount.get(st.nationalId) ?? 0) > 1,
      };
    }),
  });
}

/** Create every missing account. Idempotent: an existing login number is never
    reissued, because a boy has it written down. */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const { studentId } = await req.json().catch(() => ({}));

  const [students, existing] = await Promise.all([
    db.student.findMany({
      where: studentId ? { id: String(studentId) } : { status: 'ACTIVE' },
      /* By halaqa then name, so 1001 upward runs down the sheet a teacher
         actually holds rather than in whatever order the database returns. */
      orderBy: [{ halaqaId: 'asc' }, { fullName: 'asc' }],
    }),
    db.studentCredential.findMany(),
  ]);

  const have = new Map(existing.map((c) => [c.studentId, c]));
  const taken = new Set(existing.map((c) => c.username));
  let next = LOGIN_ID_FIRST;
  const nextFree = () => {
    while (taken.has(String(next))) next++;
    const id = String(next);
    taken.add(id);
    return id;
  };

  const issued: { studentId: string; fullName: string; username: string; nationalId: string }[] = [];
  let skipped = 0, noId = 0;

  for (const st of students) {
    if (!st.nationalId) { noId++; continue; }
    const mine = have.get(st.id);
    if (mine && !studentId) { skipped++; continue; }

    const username = mine?.username ?? nextFree();
    const pinHash = await hashPin(st.nationalId);

    await db.studentCredential.upsert({
      where: { studentId: st.id },
      create: { studentId: st.id, username, pinHash, mustChangePin: false },
      update: { username, pinHash, mustChangePin: false, failedAttempts: 0, lockedUntil: null },
    });
    issued.push({ studentId: st.id, fullName: st.fullName, username, nationalId: st.nationalId });
  }

  await db.auditLog.create({
    data: {
      actorId: s.sub,
      action: studentId ? 'STUDENT_CREDENTIAL_RESET' : 'STUDENT_CREDENTIALS_CREATE',
      entity: 'student_credential',
      entityId: studentId ? String(studentId) : `${issued.length} حساب`,
    },
  }).catch(() => { /* the accounts matter more than the trail */ });

  return NextResponse.json({ ok: true, issued, skipped, noNationalId: noId });
}
