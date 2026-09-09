import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/* Runs on the edge, so it cannot import lib/auth (which pulls in Prisma).
   It only checks that the cookie is a valid, unexpired token FOR THE RIGHT
   AUDIENCE; every route handler still authorises properly on the server.

   Two audiences, never interchangeable. The supervisor's token opens /admin
   and /print — the sheets carry a hundred and seventeen boys' names, levels
   and scores. A student's token opens /student and nothing else, and reaches
   only his own rows once it gets there. An admin token presented to a student
   route is refused, and the reverse: they are different people, not different
   permissions on one account. */

async function valid(token: string | undefined, audience: 'admin' | 'student') {
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { audience });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  /* ── the student surface ─────────────────────────────────────────────── */
  if (pathname.startsWith('/student') || pathname.startsWith('/api/student')) {
    /* Signing in cannot require being signed in. */
    if (pathname === '/student/login' || pathname.startsWith('/api/student/auth')) {
      return NextResponse.next();
    }
    const token = req.cookies.get('halqah_student')?.value;
    if (await valid(token, 'student')) return NextResponse.next();

    /* An API answers 401 in JSON. A redirect there would hand fetch() an HTML
       login page and the caller would parse it as data. */
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = '/student/login';
    url.search = '';
    url.searchParams.set('next', pathname + search);
    if (token) url.searchParams.set('reason', 'expired');
    return NextResponse.redirect(url);
  }

  /* ── the supervisor's surface ────────────────────────────────────────── */
  const token = req.cookies.get('halqah_session')?.value;
  if (await valid(token, 'admin')) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('next', pathname + search);
  if (token) url.searchParams.set('reason', 'expired');
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/print/:path*', '/student/:path*', '/api/student/:path*'],
};
