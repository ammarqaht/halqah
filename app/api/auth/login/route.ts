import { NextResponse } from 'next/server';
import { authenticate, createSession, BAD_CREDENTIALS } from '@/lib/auth';

/* Crude but effective while there is one account: a short lockout after
   repeated failures, keyed by identifier + IP. Replaced by a real store when
   there is more than one supervisor. */
const attempts = new Map<string, { n: number; until: number }>();
const WINDOW = 15 * 60_000;
const MAX = 8;

export async function POST(req: Request) {
  let username = '', password = '';
  try {
    const body = await req.json();
    username = String(body.username ?? '').trim();
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const key = `${username}|${ip}`;
  const rec = attempts.get(key);
  if (rec && rec.n >= MAX && Date.now() < rec.until) {
    return NextResponse.json(
      { error: 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.' }, { status: 429 });
  }

  if (!username || !password) {
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 });
  }

  let user;
  try {
    user = await authenticate(username, password);
  } catch (e) {
    /* A database fault is not a wrong password. Saying so is the difference
       between "check your typing" and "the tables are not there yet". */
    const msg = e instanceof Error ? e.message : '';
    const missing = /does not exist|relation .* does not exist|P2021/i.test(msg);
    const down    = /Can't reach|ECONNREFUSED|P1001/i.test(msg);
    return NextResponse.json({
      error: missing
        ? 'قاعدة البيانات لم تُهيَّأ بعد — لم تُنشأ الجداول. راجع سجلّ النشر.'
        : down
        ? 'تعذّر الاتصال بقاعدة البيانات.'
        : 'خطأ في الخادم أثناء التحقّق.',
      detail: msg.split('\n')[0].slice(0, 200),
    }, { status: 503 });
  }

  if (!user) {
    const next = rec && Date.now() < rec.until ? rec.n + 1 : 1;
    attempts.set(key, { n: next, until: Date.now() + WINDOW });
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 });
  }

  attempts.delete(key);
  await createSession(user);
  return NextResponse.json({ ok: true, name: user.fullName });
}
