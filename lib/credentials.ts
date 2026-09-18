import type { Prisma } from '@prisma/client';
import { hashPassword, hashPin, LOGIN_ID_FIRST, TEACHER_ID_FIRST } from '@/lib/auth';
import { CODE_ALPHABET } from '@/lib/points';
import { stripTeacherPrefix } from '@/lib/normalise';

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


/* ── حسابات المعلمين ─────────────────────────────────────────────────────────
   «وأسماء المعلمين السبعة موجودة في النظام اليوم داخل بطاقات الحلقات، فتُشتقّ
   منها الحسابات ولا تُكتب من جديد».

   So this reads `halaqat.teacher` — the name the roster file carried in — and
   gives each halaqa's teacher an account bound to it. Nothing is typed twice,
   and nobody has to decide which of seven names goes with which halaqa: the
   card already says. */

export type IssuedTeacher = {
  teacherId: string;
  fullName: string;
  halaqaId: string;
  halaqaName: string;
  username: string;
  /** Shown ONCE, on the screen that issued it, and never stored in the clear. */
  password: string;
};

/**
 * A readable temporary password.
 *
 * The supervisor reads this to a teacher, or writes it on the slip he hands
 * him, so the alphabet is the printed-card one from `lib/points.ts`: no I, O,
 * U, 1 or 0, because every glyph removed is a pair that can no longer be
 * misread. He replaces it on first sign-in, which is what makes a temporary
 * password acceptable at all.
 */
export function temporaryPassword(): string {
  const out: string[] = [];
  const a = CODE_ALPHABET;
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (const b of bytes) {
    if (b >= 240) continue;                                   // 240 = 8 × 30, unbiased
    out.push(a[b % a.length]);
    if (out.length === 8) break;
  }
  while (out.length < 8) out.push(a[Math.floor(Math.random() * a.length)]);
  /* Two groups of four, which is how an eye reads eight glyphs off a slip. */
  return `${out.slice(0, 4).join('')}-${out.slice(4).join('')}`;
}

/**
 * Give an account to the teacher of every halaqa that has none.
 *
 * The login number is the next free one from 2001 upward — never one that has
 * been handed out, because a teacher has his written down — and each account is
 * bound to the halaqa whose card named him. A halaqa whose `teacher` cell is
 * empty is returned in `unnamed` so the screen can say which, rather than
 * quietly doing less than it was asked.
 *
 * Idempotent: a halaqa that already has a bound teacher is passed over
 * untouched, so this is safe to call on every save.
 */
export async function issueMissingTeachers(
  tx: Prisma.TransactionClient,
  halaqaIds?: string[],
): Promise<{ issued: IssuedTeacher[]; unnamed: string[] }> {
  const where = halaqaIds?.length ? { id: { in: halaqaIds } } : {};

  const [halaqat, existing] = await Promise.all([
    tx.halaqa.findMany({ where, orderBy: { name: 'asc' },
      select: { id: true, name: true, teacher: true, teacherId: true } }),
    tx.teacher.findMany({ select: { username: true } }),
  ]);

  const taken = new Set(existing.map((t) => t.username));
  let next = TEACHER_ID_FIRST;
  const nextFree = () => {
    while (taken.has(String(next))) next++;
    const id = String(next);
    taken.add(id);
    return id;
  };

  const issued: IssuedTeacher[] = [];
  const unnamed: string[] = [];

  for (const h of halaqat) {
    if (h.teacherId) continue;
    const fullName = stripTeacherPrefix(h.teacher ?? '').trim();
    if (!fullName) { unnamed.push(h.name); continue; }

    const username = nextFree();
    const password = temporaryPassword();
    const teacher = await tx.teacher.create({
      data: {
        fullName,
        username,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      },
      select: { id: true },
    });
    /* Bound from the halaqa's side, where the `@unique` on `teacher_id` is what
       enforces «لكل معلم حلقة واحدة لا أكثر». */
    await tx.halaqa.update({ where: { id: h.id }, data: { teacherId: teacher.id } });

    issued.push({
      teacherId: teacher.id, fullName, halaqaId: h.id, halaqaName: h.name,
      username, password,
    });
  }

  return { issued, unnamed };
}

/** A password the supervisor reset, or one a teacher chose. Returns the plain
    text ONLY for the reset case, because that is the one he has to read out. */
export async function resetTeacherPassword(
  tx: Prisma.TransactionClient, teacherId: string,
): Promise<string> {
  const password = temporaryPassword();
  await tx.teacher.update({
    where: { id: teacherId },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
  return password;
}
