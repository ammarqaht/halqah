import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { json } from '@/lib/compress';

/* المنهج — على حدة، وعند الطلب.
 *
 * It was in `GET /api/state`, which every supervisor screen calls on arrival.
 * Measured against the live database: 3,572 rows, 520 KB, SEVENTY-THREE
 * SECONDS — two thirds of the payload and almost all of the wait, on every
 * page load, for a table only the plans and exam screens ever read.
 *
 * So it is its own endpoint now, fetched by the screens that need it and by
 * nothing else. And it is CACHED: the curriculum changes when «منهج الحفظ» is
 * imported and at no other time, so a browser that already has it sends its
 * ETag back and gets a 304 with no body at all.
 *
 * The ETag is the same fingerprint `PUT /api/state` uses to decide whether to
 * rewrite the table — one hash, one meaning, and the two can never disagree
 * about whether the curriculum changed.
 */

async function fingerprint(): Promise<string> {
  const [row] = await db.$queryRaw<{ n: bigint; sig: string | null }[]>`
    SELECT count(*) AS n,
           md5(string_agg(h, '' ORDER BY h)) AS sig
      FROM (SELECT md5(track || '|' || level || '|' || day_no || '|' || kind
                       || '|' || from_surah || '|' || from_ayah || '|'
                       || to_surah || '|' || to_ayah || '|' || note) AS h
              FROM curriculum_days) q`;
  return `"${Number(row?.n ?? 0)}-${row?.sig ?? 'empty'}"`;
}

export async function GET(req: Request) {
  if (!await readSession()) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const tag = await fingerprint();

  /* The whole point: a browser that already holds this term's curriculum gets
     a 304 and no body — a round trip instead of 520 KB over a slow link. */
  if (req.headers.get('if-none-match') === tag) {
    return new NextResponse(null, { status: 304, headers: { ETag: tag } });
  }

  const curriculum = await db.curriculumDay.findMany();

  return json({ curriculum }, req, {
    headers: {
      ETag: tag,
      /* `must-revalidate` rather than a max-age: an edited منهج must reach the
         screen that prints a boy's sheet immediately, and the revalidation is
         one cheap hash. */
      'Cache-Control': 'private, no-cache, must-revalidate',
    },
  });
}
