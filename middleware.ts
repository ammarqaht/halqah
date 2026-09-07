import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/* Runs on the edge, so it cannot import lib/auth (which pulls in Prisma).
   It only checks that the cookie is a valid, unexpired token for this audience;
   every route handler still authorises properly on the server. */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get('halqah_session')?.value;
  const secret = process.env.AUTH_SECRET;

  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret), { audience: 'admin' });
      return NextResponse.next();
    } catch { /* fall through to the redirect */ }
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  /* Why it is asking again, so the login screen can say «انتهت الجلسة» rather
     than leaving him wondering whether he mistyped something. */
  if (token) url.searchParams.set('reason', 'expired');
  return NextResponse.redirect(url);
}

/* Everything that is not the login screen itself.
   `/print` was open: the sheets carry students' names and levels, and anyone
   with the link could read them. `/student` was open too — no sign-in at all,
   and any visitor could pick any of the hundred and two boys by name and read
   his level and his points. Neither is a screen the public should reach, and
   the portal will need its own sign-in before students can use it again. */
export const config = {
  matcher: ['/admin/:path*', '/print/:path*', '/student/:path*'],
};
