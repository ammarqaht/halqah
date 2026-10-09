import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/* Runs on the edge, so it cannot import lib/auth (which pulls in Prisma).
   It only checks that the cookie is a valid, unexpired token FOR THE RIGHT
   AUDIENCE; every route handler still authorises properly on the server.

   Three audiences, never interchangeable. The supervisor's token opens /admin
   and /print — the sheets carry a hundred and seventeen boys' names, levels
   and scores. A teacher's token opens /teacher and reaches ONE halaqa once it
   gets there. A student's token opens /student and nothing else, and reaches
   only his own rows. A token presented at the wrong door is refused on its
   audience: they are different people, not different permissions on one
   account. */

async function claims(token: string | undefined, audience: 'admin' | 'student' | 'teacher') {
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  try {
    return (await jwtVerify(token, new TextEncoder().encode(secret), { audience })).payload;
  } catch {
    return null;
  }
}

async function valid(token: string | undefined, audience: 'admin' | 'student' | 'teacher') {
  return (await claims(token, audience)) !== null;
}

/* حساب المطوّر (see lib/dev): a teacher's or a boy's own token, marked
   `preview`. Reading passes; every write is refused HERE, before any route runs,
   so no handler has to remember the rule — one written next year is covered the
   day it lands. The screen shows the refusal as it shows any error: the button
   works and nothing is saved. The two portals' /auth paths are let through
   above, which is how its halaqa or boy is switched and how it signs out. */
const PREVIEW_REFUSED = 'وضع المعاينة — لا يُحفظ شيء.';

async function pass(req: NextRequest, token: string | undefined, audience: 'student' | 'teacher') {
  const c = await claims(token, audience);
  if (!c) return null;
  const reads = req.method === 'GET' || req.method === 'HEAD';
  if (c.preview && !reads) return NextResponse.json({ error: PREVIEW_REFUSED }, { status: 403 });
  return NextResponse.next();
}

/* Under a path SEGMENT, not a string prefix: `startsWith('/api/student')` also
   matches `/api/students` — the supervisor's own route — and once the matcher
   reached every API, that sent his student edits to the boys' door and a 401. */
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  /* ── the student surface ─────────────────────────────────────────────── */
  if (under(pathname, '/student') || under(pathname, '/api/student')) {
    /* Signing in cannot require being signed in. */
    if (pathname === '/student/login' || pathname.startsWith('/api/student/auth')) {
      return NextResponse.next();
    }
    const token = req.cookies.get('halqah_student')?.value;
    const ok = await pass(req, token, 'student');
    if (ok) return ok;

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

  /* ── the teacher's surface ───────────────────────────────────────────── */
  if (under(pathname, '/teacher') || under(pathname, '/api/teacher')) {
    if (pathname === '/teacher/login' || pathname.startsWith('/api/teacher/auth')) {
      return NextResponse.next();
    }
    const tt = req.cookies.get('halqah_teacher')?.value;
    const ok = await pass(req, tt, 'teacher');
    if (ok) return ok;

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = '/teacher/login';
    url.search = '';
    url.searchParams.set('next', pathname + search);
    if (tt) url.searchParams.set('reason', 'expired');
    return NextResponse.redirect(url);
  }

  /* ── every other API: the supervisor's ─────────────────────────────────
     Each of these routes checks its own session, so nothing changes for them
     — except under حساب المطوّر (3999, lib/dev): its token is marked `preview`,
     and a write from it is refused here, before any route runs. Signing out
     and the idle timer's touch are let through; they write only the cookie. */
  if (pathname.startsWith('/api/')) {
    const reads = req.method === 'GET' || req.method === 'HEAD';
    if (!reads && pathname !== '/api/auth/logout' && pathname !== '/api/auth/touch'
        && pathname !== '/api/auth/login') {
      const c = await claims(req.cookies.get('halqah_session')?.value, 'admin');
      if (c?.preview) return NextResponse.json({ error: PREVIEW_REFUSED }, { status: 403 });
    }
    return NextResponse.next();
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
  matcher: [
    '/admin/:path*', '/print/:path*',
    '/student/:path*', '/api/student/:path*',
    '/teacher/:path*', '/api/teacher/:path*',
    /* The supervisor's APIs — only so حساب المطوّر's writes can be refused. */
    '/api/:path*',
  ],
};
