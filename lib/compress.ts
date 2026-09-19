import { gzipSync } from 'node:zlib';
import { NextResponse } from 'next/server';

/* ردّ مضغوط.
 *
 * Next does not compress what a route handler returns — measured on the live
 * server, `/api/curriculum` went out as 532 KB of uncompressed JSON with no
 * `content-encoding` header at all. Over the link to the database host that is
 * most of a minute, and the payload is the most compressible shape there is:
 * three and a half thousand rows of short repeated strings.
 *
 * So it is gzipped here, when the caller says it can read gzip — which every
 * browser does. A caller that does not gets the plain JSON it asked for.
 */
export function json(
  body: unknown,
  req: Request,
  init: { status?: number; headers?: Record<string, string> } = {},
): NextResponse {
  const text = JSON.stringify(body);
  const accepts = (req.headers.get('accept-encoding') ?? '').includes('gzip');

  if (!accepts || text.length < 1024) {
    return NextResponse.json(body, init as ResponseInit);
  }

  const zipped = gzipSync(text, { level: 6 });
  return new NextResponse(new Uint8Array(zipped), {
    status: init.status ?? 200,
    headers: {
      ...(init.headers ?? {}),
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Content-Length': String(zipped.length),
      /* Caches must not hand a gzipped body to a client that cannot read it. */
      Vary: 'Accept-Encoding',
    },
  });
}
