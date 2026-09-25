import { NextResponse } from 'next/server';
import { readSession, createSession } from '@/lib/auth';

/* Re-issues the session cookie, which is what turns a short expiry into an
   IDLE timeout: the token lasts two hours, and every minute the supervisor
   is actually doing something the browser asks for two more.
   Stop touching it — close the laptop, walk away — and it lapses on the server
   without anything having to enforce it in the page.

   It never outlives the day: `signedInAt` is carried over, so the renewed
   token still dies twenty-four hours after the password was typed. */
export async function POST() {
  const s = await readSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  await createSession({ id: s.sub, fullName: s.name }, s.signedInAt);
  return NextResponse.json({ ok: true });
}
