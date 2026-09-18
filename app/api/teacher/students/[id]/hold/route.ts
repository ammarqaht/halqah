import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertMine, fail, scope } from '../../../_scope';

/* «يحتاج مراجعة قبل الاختبار» — رأي المعلّم، يرفعه ويرفعه عنه.

   «عند المعلم في صفحة الاختبارات أبي يظهر زر أن الطالب مب جاهز للاختبار ويحتاج
   مراجعة، ويظهر عند المشرف والطالب ذلك» (client, 18 Sep 2026).

   THE POINTER SAYS HE REACHED HIS EXAM مقرّر; only his teacher knows whether he
   is ready to sit it. That was the one thing this system asked the supervisor
   to find out by telephone.

   It GATES NOTHING. A booking still books and an exam still records — «المعلم
   لا يمكن أن يحدد مقرر الطالب … عليه التوجه إلى مشرف الحلقة» cuts both ways,
   and a teacher who could block a sitting would be deciding the curriculum. So
   this writes an opinion, signs it with his name, and dates it. */

const MAX_NOTE = 200;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;

  const { id } = await ctx.params;
  if (!(await assertMine(who.halaqaId, id))) {
    return fail('هذا الطالب ليس في حلقتك.', 403);
  }

  const body = await req.json().catch(() => ({}));
  const on = body?.on !== false;
  const note = String(body?.note ?? '').trim().slice(0, MAX_NOTE);

  const hold = on
    ? { examHoldAt: new Date(), examHoldBy: who.name, examHoldNote: note }
    : { examHoldAt: null, examHoldBy: null, examHoldNote: '' };

  /* Upsert, because a boy whose teacher has not saved a day for him yet has no
     pointer row — and «ليس جاهزًا» is exactly the thing one would want to say
     about a boy before anything else has been recorded. */
  const row = await db.studentProgress.upsert({
    where: { studentId: id },
    create: { studentId: id, ...hold },
    update: hold,
  });

  return NextResponse.json({
    ok: true,
    examHold: row.examHoldAt
      ? {
          at: row.examHoldAt.toISOString(),
          by: row.examHoldBy ?? '',
          note: row.examHoldNote,
        }
      : null,
  });
}
