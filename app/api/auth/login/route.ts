import { NextResponse } from 'next/server';
import { authenticate, createSession, BAD_CREDENTIALS } from '@/lib/auth';
import { isDevLogin, DEV_NAME, DEV_SUB } from '@/lib/dev';
import { ipOf, isLocked, recordFailure, clearFailures, LOCKED_AR } from '@/lib/loginLimit';

/* The lockout is lib/loginLimit — shared with the teacher portal's door for a
   supervisor standing in, so the two cannot add up to twice the guesses. */

export async function POST(req: Request) {
  let username = '', password = '';
  try {
    const body = await req.json();
    username = String(body.username ?? '').trim();
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 400 });
  }

  const ip = ipOf(req);
  if (isLocked(username, ip)) return NextResponse.json({ error: LOCKED_AR }, { status: 429 });

  if (!username || !password) {
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 });
  }

  /* حساب المطوّر — 3999 and the developer's PIN (lib/dev). No database row:
     a token marked `preview`, which sees every screen and whose every write the
     middleware refuses. */
  if (isDevLogin(username, password, 'admin')) {
    await createSession({ id: DEV_SUB, fullName: DEV_NAME }, undefined, DEV_NAME);
    return NextResponse.json({ ok: true, name: DEV_NAME, preview: true });
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
    recordFailure(username, ip);
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 });
  }

  clearFailures(username, ip);
  await createSession(user);
  return NextResponse.json({ ok: true, name: user.fullName });
}
