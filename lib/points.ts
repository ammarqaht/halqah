/* Points rules — SPEC.md §4.6, §4.7, §4.10, §4.11, and the approved PDF §8/§11.
   Pure functions. No storage, no React. Every client decision that touches a
   number lives here, so a change is one edit and not a hunt through screens.

   The governing principle from §11: «النظام يقترح، وأنت تقرّر» — nothing here
   awards anything by itself; it computes what the supervisor is offered. */
import type { Gift, PointCode, PointCodeBatch, PointTxn, Student, Track } from './types';

/* ── Settings ────────────────────────────────────────────────────────────────
   SPEC.md §3.8 seeds these into a `settings` table so they are never hard-coded
   in application code. Until that table exists they live here, in one object,
   read through the accessors below and nowhere else. */

export type ExamType = 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | 'ASSOCIATION' | 'MOCK' | 'TAJWEED';

export const EXAM_TYPE_AR: Record<ExamType, string> = {
  BADGE_GOLDEN: 'الوسام الذهبي', BADGE_DIAMOND: 'الوسام الماسي',
  ASSOCIATION: 'اختبار الجمعية', MOCK: 'اختبار تجريبي', TAJWEED: 'اختبار تجويد',
};

/** One-word labels for columns with no room for «الوسام الذهبي» twice a row. */
export const EXAM_TYPE_SHORT_AR: Record<ExamType, string> = {
  BADGE_GOLDEN: 'الذهبي', BADGE_DIAMOND: 'الماسي', ASSOCIATION: 'الجمعية',
  MOCK: 'تجريبي', TAJWEED: 'تجويد',
};

/** The chip tone per exam type — the SAME everywhere a type is coloured, so a
    diamond is one colour across the log, the follow-up and the prints.
    `assoc` is DESIGN §1.3's reserved association palette. */
export const EXAM_TYPE_TONE: Record<ExamType, 'warn' | 'brand' | 'assoc' | 'info' | 'ink'> = {
  BADGE_GOLDEN: 'warn', BADGE_DIAMOND: 'brand', ASSOCIATION: 'assoc',
  MOCK: 'ink', TAJWEED: 'info',
};

/** §13.5, verbatim: الفضي ٥٠/١٠٠/٢٠٠ · الذهبي ١٠٠/٢٠٠/٢٠٠. */
export const EXAM_POINTS: Record<'SILVER' | 'GOLDEN', Record<string, number>> = {
  SILVER: { BADGE_GOLDEN: 50, BADGE_DIAMOND: 100, ASSOCIATION: 200 },
  GOLDEN: { BADGE_GOLDEN: 100, BADGE_DIAMOND: 200, ASSOCIATION: 200 },
};

/**
 * §4.6 — what passing an exam is worth.
 * MOCK is always zero; TAJWEED is a free number the supervisor types; a Talqeen
 * student is worth zero because he sits outside the points system entirely.
 */
export function examPoints(track: Track | null, type: ExamType): number | null {
  if (!track || track === 'TALQEEN') return 0;
  if (type === 'MOCK') return 0;
  if (type === 'TAJWEED') return null;          // null ⇒ ask, do not suggest
  return EXAM_POINTS[track][type] ?? 0;
}

/**
 * §4.11 / §13.1 — «وطلابه يُستثنون من نظام النقاط».
 * Talqeen is a classification, not a curriculum: no level, no plan, no points,
 * no store. Guard every mutation with this, not only the screens.
 */
export const earnsPoints = (s: Pick<Student, 'track'>) => s.track !== 'TALQEEN' && s.track !== null;

/* ── Balances ────────────────────────────────────────────────────────────────
   §4.10 — a balance is the sum of its movements, never a stored column, so it
   is structurally incapable of drifting from its own ledger. */

export type Balance = {
  balance: number;
  /** Everything ever added: manual grants, cards, exam awards, refunds. */
  granted: number;
  /** Everything ever taken, as a positive figure — purchases and deductions. */
  redeemed: number;
  lastAt: string | null;
  moves: number;
};

export const EMPTY_BALANCE: Balance = { balance: 0, granted: 0, redeemed: 0, lastAt: null, moves: 0 };

/** One pass over the whole ledger, not one pass per student. */
export function balances(txns: PointTxn[]): Map<string, Balance> {
  const m = new Map<string, Balance>();
  for (const t of txns) {
    const b = m.get(t.studentId) ?? { ...EMPTY_BALANCE };
    b.balance += t.delta;
    if (t.delta >= 0) b.granted += t.delta; else b.redeemed += -t.delta;
    b.moves += 1;
    if (!b.lastAt || t.createdAt > b.lastAt) b.lastAt = t.createdAt;
    m.set(t.studentId, b);
  }
  return m;
}

export const balanceOf = (txns: PointTxn[], studentId: string): number =>
  txns.reduce((sum, t) => (t.studentId === studentId ? sum + t.delta : sum), 0);

/* ── Codes ───────────────────────────────────────────────────────────────────
   SPEC.md §3.5. Ten characters of Crockford base32 with I, O, U, 1 and 0 also
   removed — a child reads these off a paper card, and every glyph removed is a
   pair he can no longer confuse. Thirty symbols over ten places leaves guessing
   far outside the threat model, and uniqueness is still checked rather than
   assumed. */

export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 10;

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
  return a;
}

/**
 * One code. Rejection sampling rather than a plain modulo: 256 is not a
 * multiple of 30, so `byte % 30` would make the first sixteen symbols about 6%
 * likelier than the rest — a bias printed onto every card we hand out.
 */
export function generateCode(): string {
  const out: string[] = [];
  while (out.length < CODE_LENGTH) {
    for (const b of randomBytes(CODE_LENGTH)) {
      if (b >= 240) continue;                        // 240 = 8 × 30
      out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out.join('');
}

/** Printed in two groups of five, which is how an eye actually reads ten glyphs. */
export const formatCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`;

/** What the student typed becomes what we stored: case, spaces and dashes are noise. */
export const normaliseCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** `quantity` fresh codes, unique among themselves and against `existing`. */
export function generateCodes(quantity: number, existing: Iterable<string> = []): string[] {
  const seen = new Set(existing);
  const out: string[] = [];
  while (out.length < quantity) {
    const c = generateCode();
    if (seen.has(c)) continue;                       // vanishingly rare; still checked
    seen.add(c);
    out.push(c);
  }
  return out;
}

export type CodeState = 'OK' | 'USED' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN';

/** The Arabic a student is shown, §10 (طا-٣): a reason he understands, never a
    bare failure — «هذا الكود مستخدَم من قبل» tells him to go ask his teacher. */
export const CODE_STATE_AR: Record<CodeState, string> = {
  OK: 'صالح',
  USED: 'هذا الكود مستخدَم من قبل',
  EXPIRED: 'انتهت صلاحية هذا الكود',
  REVOKED: 'أُلغيت دفعة هذا الكود',
  UNKNOWN: 'رقم غير صحيح',
};

export function codeState(
  code: PointCode | undefined,
  batch: PointCodeBatch | undefined,
  now: Date = new Date(),
): CodeState {
  if (!code || !batch) return 'UNKNOWN';
  if (code.redeemedBy) return 'USED';
  if (batch.revokedAt) return 'REVOKED';
  if (batch.expiresAt && new Date(batch.expiresAt) <= now) return 'EXPIRED';
  return 'OK';
}

export type BatchState = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SPENT';

export const BATCH_STATE_AR: Record<BatchState, string> = {
  ACTIVE: 'سارية', EXPIRED: 'منتهية', REVOKED: 'ملغاة', SPENT: 'استُهلكت',
};

export function batchState(batch: PointCodeBatch, remaining: number, now: Date = new Date()): BatchState {
  if (batch.revokedAt) return 'REVOKED';
  if (batch.expiresAt && new Date(batch.expiresAt) <= now) return 'EXPIRED';
  if (remaining === 0) return 'SPENT';
  return 'ACTIVE';
}

/**
 * §8 (إد-٤-ب): «مختلف اللون باختلاف القيمة ليسهل الفرز باليد».
 * A value always lands on the same colour, so a supervisor who sorted the
 * ten-point cards last month reaches for the same colour this month.
 */
export const CARD_COLOURS = [
  { key: 'brand', ink: '#0A403C', wash: '#E4EEEB', rule: '#7FBBB4' },
  { key: 'assoc', ink: '#1B1C57', wash: '#E7F2F8', rule: '#5AB8DE' },
  { key: 'warn',  ink: '#7F6531', wash: '#F0EADC', rule: '#E2D6BC' },
  { key: 'ok',    ink: '#3E6B54', wash: '#E3EAE4', rule: '#CBDBD0' },
  { key: 'info',  ink: '#4B5C77', wash: '#E5E9F0', rule: '#CBD3E0' },
  { key: 'risk',  ink: '#834B42', wash: '#F0E4E1', rule: '#E0C9C4' },
] as const;

export const cardColour = (value: number) =>
  CARD_COLOURS[Math.abs(Math.round(value)) % CARD_COLOURS.length];

/* ── Store rules — SPEC.md §3.6, approved PDF §8 (إد-٤-ج) ─────────────────── */

/** What the student sees on a card, and why. Out of stock is stated, not hidden:
    «ما نفدت كميته يظهر غير متوفر حاليًا» — and an unaffordable gift stays on
    display «لا يُخفى، ليكون حافزًا». */
export type GiftAvailability = 'BUYABLE' | 'OUT_OF_STOCK' | 'CANNOT_AFFORD' | 'HIDDEN';

export function giftAvailability(
  gift: Pick<Gift, 'quantity' | 'status' | 'pointsCost'>,
  balance: number,
): GiftAvailability {
  if (gift.status === 'HIDDEN') return 'HIDDEN';
  if (gift.quantity <= 0) return 'OUT_OF_STOCK';
  if (balance < gift.pointsCost) return 'CANNOT_AFFORD';
  return 'BUYABLE';
}

/** «تحتاج ٣٠ نقطة إضافية» — the gap, phrased as a target rather than a refusal. */
export const shortBy = (cost: number, balance: number) => Math.max(0, cost - balance);

/** §8: «إذا نزلت الكمية عن رقم تحدده، ظهر تنبيه في الصفحة الرئيسية». */
export const isLowStock = (gift: Pick<Gift, 'quantity' | 'lowStockThreshold' | 'status'>) =>
  gift.status === 'VISIBLE' && gift.quantity > 0 && gift.quantity <= gift.lowStockThreshold;

/**
 * The one question a purchase asks. Kept pure and separate from the mutation so
 * the same answer drives the button's disabled state, the student's message,
 * and the write itself — three places that must never disagree.
 */
export type PurchaseBlock = 'INELIGIBLE' | 'HIDDEN' | 'OUT_OF_STOCK' | 'INSUFFICIENT_BALANCE' | null;

export function purchaseBlock(
  student: Pick<Student, 'track'>,
  gift: Pick<Gift, 'quantity' | 'status' | 'pointsCost'>,
  balance: number,
): PurchaseBlock {
  if (!earnsPoints(student)) return 'INELIGIBLE';
  if (gift.status === 'HIDDEN') return 'HIDDEN';
  if (gift.quantity <= 0) return 'OUT_OF_STOCK';
  if (balance < gift.pointsCost) return 'INSUFFICIENT_BALANCE';
  return null;
}

export const PURCHASE_BLOCK_AR: Record<NonNullable<PurchaseBlock>, string> = {
  INELIGIBLE: 'طلاب التلقين خارج نظام النقاط والمتجر',
  HIDDEN: 'هذه الهدية غير معروضة حاليًا',
  OUT_OF_STOCK: 'غير متوفّر حاليًا',
  INSUFFICIENT_BALANCE: 'الرصيد لا يكفي لشراء هذه الهدية',
};
