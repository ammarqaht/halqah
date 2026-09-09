import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { hashPin, PIN_LENGTH } from '@/lib/auth';

/* حسابات الطلاب — the PINs the supervisor prints and hands to the teachers.

   The plaintext exists for exactly as long as this response: it is hashed on
   the way into the database and shown once. A reset is the only way to see one
   again, and a reset writes an audit row. */

/** Five digits, never all-same and never a run. `randomInt` is CSPRNG-backed. */
function freshPin(): string {
  for (;;) {
    let pin = '';
    for (let i = 0; i < PIN_LENGTH; i++) pin += randomInt(0, 10);
    if (/^(\d)\1{4}$/.test(pin)) continue;
    if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) continue;
    return pin;
  }
}

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

  /* A national id shared by two boys is a real thing in this roster — the
     schema says so — and it is surfaced, never silently merged. */
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
        mustChangePin: c?.mustChangePin ?? null,
        lastLoginAt: c?.lastLoginAt ? c.lastLoginAt.toISOString() : null,
        noNationalId: !st.nationalId,
        sharedNationalId: !!st.nationalId && (idCount.get(st.nationalId) ?? 0) > 1,
      };
    }),
  });
}

/** Create every missing account in one pass. Idempotent: a boy who already has
    a PIN keeps it — running this twice must not invalidate a printed sheet. */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const { studentId } = await req.json().catch(() => ({}));

  const students = await db.student.findMany({
    where: studentId ? { id: String(studentId) } : { status: 'ACTIVE' },
    orderBy: [{ dedupeKey: 'asc' }, { id: 'asc' }],
  });
  const existing = await db.studentCredential.findMany();
  const have = new Set(existing.map((c) => c.studentId));
  const takenUsernames = new Set(existing.map((c) => c.username));

  const issued: { studentId: string; fullName: string; username: string; pin: string }[] = [];
  let skipped = 0, noId = 0;

  for (const st of students) {
    /* A reset (studentId given) rotates; a bulk run never touches an account
       that exists, because someone has that PIN written down. */
    if (have.has(st.id) && !studentId) { skipped++; continue; }
    if (!st.nationalId) { noId++; continue; }

    /* Two boys, one id — the first keeps it bare, the next take a suffix. */
    let username = st.nationalId;
    if (!(have.has(st.id) && existing.find((c) => c.studentId === st.id)?.username === username)) {
      let n = 2;
      while (takenUsernames.has(username)) username = `${st.nationalId}-${n++}`;
    }
    takenUsernames.add(username);

    const pin = freshPin();
    const pinHash = await hashPin(pin);

    await db.studentCredential.upsert({
      where: { studentId: st.id },
      create: { studentId: st.id, username, pinHash, mustChangePin: true },
      update: { pinHash, mustChangePin: true, failedAttempts: 0, lockedUntil: null },
    });
    issued.push({ studentId: st.id, fullName: st.fullName, username, pin });
  }

  await db.auditLog.create({
    data: {
      actorId: s.sub,
      action: studentId ? 'STUDENT_PIN_RESET' : 'STUDENT_CREDENTIALS_CREATE',
      entity: 'student_credential',
      entityId: studentId ? String(studentId) : `${issued.length} حساب`,
    },
  }).catch(() => { /* the accounts matter more than the trail */ });

  return NextResponse.json({ ok: true, issued, skipped, noNationalId: noId });
}
