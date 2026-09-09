import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope, fail } from '../_scope';
import { normaliseCode, CODE_STATE_AR, earnsPoints } from '@/lib/points';
import type { Track } from '@/lib/types';

/* شحن كود — طا-٣.
   The guarantee is the CONDITIONAL UPDATE, not a read-then-write. Two taps, two
   tabs, or two phones can arrive in the same millisecond; only the update whose
   `where` still matches `redeemedBy: null` affects a row, and the other sees
   count === 0 and is told the code is spent. A read-then-write would let both
   through and pay twice. */

const WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 10;

/* Per-process, deliberately. A shared counter would need a table write on every
   wrong guess; this costs nothing and holds for the lifetime of the container,
   which is the timescale the throttle cares about. The AuditLog row below is
   the durable record. */
const failures = new Map<string, number[]>();

function tooMany(studentId: string): boolean {
  const now = Date.now();
  const recent = (failures.get(studentId) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(studentId, recent);
  return recent.length >= MAX_FAILURES;
}
function noteFailure(studentId: string) {
  const now = Date.now();
  failures.set(studentId, [...(failures.get(studentId) ?? []).filter((t) => now - t < WINDOW_MS), now]);
}

export async function POST(req: Request) {
  const g = await scope();
  if (!g.ok) return g.res;

  const student = await db.student.findUnique({ where: { id: g.s.sub } });
  if (!student) return fail('لم يُعثر على الطالب.', 404);

  /* §13.1 — talqeen sits outside the points system entirely. Refused before
     the code is even looked at, so a valid card is not spent on him. */
  if (!earnsPoints({ track: student.track as Track | null })) {
    return fail('هذا الحساب لا يستقبل نقاطًا.', 403);
  }

  if (tooMany(student.id)) {
    await db.auditLog.create({
      data: { actorId: null, action: 'REDEEM_THROTTLED', entity: 'redeem_abuse',
              entityId: student.id },
    }).catch(() => { /* the refusal matters more than its trail */ });
    return fail('محاولات كثيرة خاطئة. انتظر عشر دقائق ثم أعد المحاولة.', 429);
  }

  const code = normaliseCode(String((await req.json().catch(() => ({}))).code ?? ''));
  if (!code) return fail(CODE_STATE_AR.UNKNOWN);

  try {
    const result = await db.$transaction(async (tx) => {
      const row = await tx.pointCode.findUnique({ where: { code }, include: { batch: true } });
      if (!row) return { error: CODE_STATE_AR.UNKNOWN as string };
      if (row.batch.revokedAt) return { error: CODE_STATE_AR.REVOKED };
      if (row.batch.expiresAt && row.batch.expiresAt <= new Date()) {
        return { error: CODE_STATE_AR.EXPIRED };
      }

      /* THE line. Only one caller can match `redeemedBy: null`. */
      const claimed = await tx.pointCode.updateMany({
        where: { code, redeemedBy: null },
        data: { redeemedBy: student.id, redeemedAt: new Date() },
      });
      if (claimed.count === 0) return { error: CODE_STATE_AR.USED };

      await tx.pointTxn.create({
        data: {
          id: `tx-${row.id}`,
          studentId: student.id,
          delta: row.batch.value,
          kind: 'CODE',
          reason: row.batch.purpose || 'شحن كود',
          refType: 'code',
          refId: row.id,
          createdBy: null,          // he redeemed it himself
        },
      });

      const txns = await tx.pointTxn.findMany({
        where: { studentId: student.id }, select: { delta: true } });
      return { value: row.batch.value, balance: txns.reduce((n, t) => n + t.delta, 0) };
    });

    if ('error' in result && result.error) { noteFailure(student.id); return fail(result.error); }
    return NextResponse.json({ ok: true, ...result });
  } catch {
    noteFailure(student.id);
    return fail('تعذّر شحن الكود. أعد المحاولة.', 500);
  }
}
