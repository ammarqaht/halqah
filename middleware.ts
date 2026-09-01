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
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/admin/:path*'] };
