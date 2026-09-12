import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { halaqaLabel, shortName } from '@/lib/normalise';

/* بطاقات الطلاب — what each boy is handed.

   The password is his own national id, which the credential table stores only
   as a bcrypt hash. So the card reads it from the STUDENT row, not from the
   credential: the scheme's whole point is that the password is a thing he
   already has, and that is the one place it legitimately still exists.

   Confidential by nature — this lives under the admin matcher, and a card
   carries one boy's details and nobody else's. */
export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const studentId = q.get('student');
  const halaqaId = q.get('halaqa');

  const students = await db.student.findMany({
    where: {
      ...(studentId ? { id: studentId } : { status: 'ACTIVE' }),
      ...(halaqaId && !studentId ? { halaqaId } : {}),
    },
    orderBy: [{ halaqaId: 'asc' }, { fullName: 'asc' }],
  });

  const [creds, halaqat] = await Promise.all([
    db.studentCredential.findMany({ select: { studentId: true, username: true } }),
    db.halaqa.findMany({ select: { id: true, name: true, teacher: true } }),
  ]);
  const login = new Map(creds.map((c) => [c.studentId, c.username]));
  const halaqa = new Map(halaqat.map((h) => [h.id, halaqaLabel(shortName(h.teacher || h.name))]));

  return NextResponse.json({
    cards: students.map((st) => ({
      id: st.id,
      fullName: st.fullName,
      halaqa: st.halaqaId ? halaqa.get(st.halaqaId) ?? null : null,
      username: login.get(st.id) ?? null,
      /* No account yet, or no national id: the card says so rather than
         printing a blank a teacher would hand over without noticing. */
      password: st.nationalId,
    })),
  });
}
