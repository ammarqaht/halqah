import { NextResponse } from 'next/server';
import { readSession, createSession } from '@/lib/auth';

/* Re-issues the session cookie, which is what turns a short expiry into an
   IDLE timeout: the token lasts five minutes, and every minute the supervisor
   is actually doing something the browser asks for five more.
   Stop touching it — close the laptop, walk away — and it lapses on the server
   without anything having to enforce it in the page. */
export async function POST() {
  const s = await readSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  await createSession({ id: s.sub, fullName: s.name });
  return NextResponse.json({ ok: true });
}
