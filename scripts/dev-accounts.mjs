/* كلمات مرور التطوير — لهذا الجهاز وحده.
 *
 *   npm run dev:accounts
 *
 * `bootstrap.mjs` يضع المشرف الأول بـ admin/12345 ثم لا يمسّه أبدًا: إعادة
 * النشر يجب ألّا تُرجع كلمة مرور غُيِّرت منذ ذلك. وهذا هو الوجه الآخر من
 * الحاجة — قاعدة تطوير جُرِّبت عليها كلمات مرور ونُسيت، والدخول إليها صار
 * أصعب من العمل نفسه. فهذا يفرض ما يفرضه ولا يعتذر:
 *
 *   المشرف : admin / 12345
 *   المعلم : رقمه (٢٠٠١، ٢٠٠٢، …) / 12345 — وبلا مطالبة بالتغيير
 *
 * والطالب لا شأن له هنا: كلمة مروره رقم هويته، وهي في السجلّ أصلًا.
 *
 * ولا يعمل إلّا على قاعدة محلّية. `DATABASE_URL` التي تشير إلى خادم بعيد
 * تُرفض عند الباب، لأن السكربت الذي يعيد كلمة مرور كل معلّم إلى «12345» لا
 * يُراد له أن يُشغَّل بالخطأ على قاعدة فيها ١٢٠ طالبًا حقيقيًّا.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const USERNAME = 'admin';
const PASSWORD = '12345';
const FULL_NAME = 'عمار سالم القحطاني';

/* المضيف وحده يقرّر. «localhost» و«127.0.0.1» محلّيتان، وما عداهما بعيد. */
const url = process.env.DATABASE_URL ?? '';
const host = (() => {
  try { return new URL(url).hostname; } catch { return ''; }
})();
if (!['localhost', '127.0.0.1', '::1', ''].includes(host)) {
  console.error(`\n  ✗ القاعدة ليست محلّية (${host}) — هذا السكربت للتطوير وحده.\n`);
  process.exit(1);
}

const db = new PrismaClient();
const hash = await bcrypt.hash(PASSWORD, 12);

try {
  const admin = await db.adminUser.upsert({
    where: { username: USERNAME },
    create: { fullName: FULL_NAME, username: USERNAME, passwordHash: hash, role: 'SUPERVISOR', active: true },
    update: { passwordHash: hash, active: true },
  });

  /* الحلقة بلا حساب معلّم لا يُدخل إليها أصلًا. في البوّابة يصنعها المشرف
     بضغطة، وهنا تُصنع بالقاعدة نفسها: الاسم من بطاقة الحلقة، والرقم ٢٠٠١ فما
     بعده، والحساب مربوط من جهة الحلقة حيث يُمنع أن يكون لمعلّم حلقتان. */
  const halaqat = await db.halaqa.findMany({
    where: { teacherId: null }, orderBy: { name: 'asc' },
    select: { id: true, name: true, teacher: true },
  });
  const taken = new Set((await db.teacher.findMany({ select: { username: true } }))
    .map((t) => t.username));
  let next = 2001;
  const unnamed = [];
  let made = 0;

  for (const h of halaqat) {
    /* «١) فلان» في ملفات العميل — الرقم ترتيبٌ في ورقة لا جزءٌ من الاسم. */
    const fullName = String(h.teacher ?? '').replace(/^\d+\)\s*/, '').replace(/\s+/g, ' ').trim();
    if (!fullName) { unnamed.push(h.name); continue; }
    while (taken.has(String(next))) next++;
    const username = String(next);
    taken.add(username);
    const t = await db.teacher.create({
      data: { fullName, username, passwordHash: hash, mustChangePassword: false },
      select: { id: true },
    });
    await db.halaqa.update({ where: { id: h.id }, data: { teacherId: t.id } });
    made++;
  }

  /* «بلا مطالبة بالتغيير»: أول دخول يطلب تغييرها، وهو في التطوير حاجزٌ يُعبر
     كل مرة من جديد بلا فائدة. */
  const teachers = await db.teacher.updateMany({
    data: { passwordHash: hash, mustChangePassword: false, failedAttempts: 0, lockedUntil: null },
  });

  console.log('\n  ✓ حسابات التطوير جاهزة');
  console.log('  ────────────────────────────────');
  console.log('  المشرف  :', admin.username, '/', PASSWORD);
  console.log('  المعلمون:', teachers.count, 'معلّمًا — رقمه /', PASSWORD,
    made ? `(أُنشئ منهم ${made})` : '');
  if (unnamed.length) console.log('  بلا اسم معلّم:', unnamed.join('، '));
  console.log('  الطالب  : رقمه / رقم هويته (كما هو)\n');
} finally {
  await db.$disconnect();
}
