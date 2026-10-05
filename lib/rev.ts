/* ─────────────────────────────────────────────────────────────────────────────
   رقم نسخة البيانات — so an old page cannot write over a newer one.

   «ما يقدر يطبع الخطة لذا الطلاب … ولا يغير مستواه» (client, 5 Oct 2026),
   with the desktop and the laptop both open on the supervisor's side.

   /api/state saves by REPLACING every list the browser holds — students,
   plans, exams, the ledger. A page opened in the morning still holds the
   morning's copy; the first thing it saved in the afternoon put the morning
   back for everyone: tracks reverted, levels set elsewhere undone, plans
   issued on the other machine deleted. Last write won, and the last writer
   was the stalest page in the building.

   So the data carries a number. Every write to those tables raises it; a save
   says which number it was built on; a save built on an older one is refused
   with 409 `stale`, and the browser takes the newer data, lays its own unsent
   changes on top, and saves again. Kept in `settings` under one key, locked
   FOR UPDATE inside the writer's transaction so two saves cannot both pass.
   ───────────────────────────────────────────────────────────────────────── */
import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

const KEY = 'state_rev';

/** The current number, locked until the surrounding transaction ends. */
export async function lockRev(tx: Tx): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO settings (key, value, updated_at) VALUES (${KEY}, '0'::jsonb, now())
    ON CONFLICT (key) DO NOTHING`;
  const rows = await tx.$queryRaw<{ value: unknown }[]>`
    SELECT value FROM settings WHERE key = ${KEY} FOR UPDATE`;
  return Number(rows[0]?.value ?? 0) || 0;
}

/** Raise it — call after any write to the tables /api/state replaces. */
export async function bumpRev(tx: Tx): Promise<number> {
  const n = (await lockRev(tx)) + 1;
  await tx.$executeRaw`
    UPDATE settings SET value = ${JSON.stringify(n)}::jsonb, updated_at = now() WHERE key = ${KEY}`;
  return n;
}

/** Read without locking — what a page is handed when it loads. */
export async function readRev(tx: Tx): Promise<number> {
  const rows = await tx.$queryRaw<{ value: unknown }[]>`
    SELECT value FROM settings WHERE key = ${KEY}`;
  return Number(rows[0]?.value ?? 0) || 0;
}
