import type { Prisma } from '@prisma/client';
import { hashPin, LOGIN_ID_FIRST } from '@/lib/auth';

export type IssuedAccount = {
  studentId: string;
  fullName: string;
  username: string;
};

/**
 * Give an account to every student who lacks one.
 *
 * The login number is the next free one from 1001 upward — never a number that
 * has been handed out, because a boy has his written on a card — and the
 * password is his own national id, which he cannot lose and nobody has to
 * print.
 *
 * A boy with no national id gets no account: there would be no password to set.
 * He is returned in `noNationalId` so the screen can say whose, rather than
 * quietly doing less than it was asked.
 *
 * Idempotent, and safe to call on every save: a student who already has an
 * account is passed over untouched.
 */
export async function issueMissingAccounts(
  tx: Prisma.TransactionClient,
  studentIds?: string[],
): Promise<{ issued: IssuedAccount[]; noNationalId: string[] }> {
  const where = studentIds?.length
    ? { id: { in: studentIds }, status: 'ACTIVE' as const }
    : { status: 'ACTIVE' as const };

  const [students, existing] = await Promise.all([
    tx.student.findMany({
      where,
      /* By halaqa then name, so the numbers run down the sheet a teacher
         actually holds rather than in whatever order the database returns. */
      orderBy: [{ halaqaId: 'asc' }, { fullName: 'asc' }],
      select: { id: true, fullName: true, nationalId: true },
    }),
    tx.studentCredential.findMany({ select: { studentId: true, username: true } }),
  ]);

  const have = new Set(existing.map((c) => c.studentId));
  const taken = new Set(existing.map((c) => c.username));
  let next = LOGIN_ID_FIRST;
  const nextFree = () => {
    while (taken.has(String(next))) next++;
    const id = String(next);
    taken.add(id);
    return id;
  };

  const issued: IssuedAccount[] = [];
  const noNationalId: string[] = [];

  for (const st of students) {
    if (have.has(st.id)) continue;
    if (!st.nationalId) { noNationalId.push(st.fullName); continue; }

    const username = nextFree();
    await tx.studentCredential.create({
      data: {
        studentId: st.id,
        username,
        pinHash: await hashPin(st.nationalId),
        mustChangePin: false,
      },
    });
    issued.push({ studentId: st.id, fullName: st.fullName, username });
  }

  return { issued, noNationalId };
}
