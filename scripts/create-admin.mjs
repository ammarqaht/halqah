/* Creates or resets the supervisor account.
   Usage:  node scripts/create-admin.mjs "الاسم" اسم_المستخدم [كلمة_المرور]
   With no password, a strong one is generated and printed once. */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const db = new PrismaClient();
const [fullName, username, given] = process.argv.slice(2);

if (!fullName || !username) {
  console.error('الاستعمال: node scripts/create-admin.mjs "الاسم الكامل" اسم_المستخدم [كلمة_المرور]');
  process.exit(1);
}

/* Crockford-ish base32: no I O U 1 0, so a printed password is unambiguous. */
const gen = (n = 14) => {
  const A = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  return [...randomBytes(n)].map((b) => A[b % A.length]).join('');
};

const password = given || gen();
const passwordHash = await bcrypt.hash(password, 12);

const user = await db.adminUser.upsert({
  where: { username },
  create: { fullName, username, passwordHash, role: 'SUPERVISOR', active: true },
  update: { fullName, passwordHash, active: true },
});

console.log('\n  ✓ الحساب جاهز');
console.log('  ────────────────────────────────');
console.log('  الاسم        :', user.fullName);
console.log('  اسم المستخدم :', user.username);
if (!given) {
  console.log('  كلمة المرور  :', password);
  console.log('\n  ⚠ لن تُعرض مرة أخرى. احفظها الآن.');
}
console.log();
await db.$disconnect();
