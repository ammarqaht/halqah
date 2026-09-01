/* SPEC.md §4: «Unit-test every one of these — they encode client decisions and a
   silent bug here corrupts every screen.» Every number asserted below is quoted
   from the approved requirements PDF (§8, §11, §13) rather than from the
   implementation, so this file fails if the code drifts from what the client
   agreed to — which is the only reason it is worth having. */
import { describe, expect, it } from 'vitest';
import {
  EXAM_POINTS, examPoints, earnsPoints, balances, balanceOf,
  generateCodes, formatCode, normaliseCode, codeState, batchState,
  giftAvailability, shortBy, isLowStock, purchaseBlock,
  cardColour, CODE_ALPHABET,
} from './points';
import type { Gift, PointCode, PointCodeBatch, PointTxn } from './types';

const txn = (studentId: string, delta: number, createdAt: string): PointTxn =>
  ({ id: `${studentId}-${createdAt}`, studentId, delta, kind: 'MANUAL', reason: 'اختبار', createdBy: 'المشرف', createdAt });

const batch = (over: Partial<PointCodeBatch> = {}): PointCodeBatch => ({
  id: 'b1', value: 10, purpose: 'حضور', quantity: 40,
  expiresAt: null, revokedAt: null, createdBy: 'المشرف', createdAt: '2026-08-01T00:00:00Z', ...over,
});

const card = (over: Partial<PointCode> = {}): PointCode =>
  ({ id: 'c1', batchId: 'b1', code: 'ABCDE23456', redeemedBy: null, redeemedAt: null, ...over });

const NOW = new Date('2026-08-31T00:00:00Z');

describe('exam points — §13.5, the approved table', () => {
  it.each([
    ['SILVER', 'BADGE_GOLDEN', 50],
    ['SILVER', 'BADGE_DIAMOND', 100],
    ['SILVER', 'ASSOCIATION', 200],
    ['GOLDEN', 'BADGE_GOLDEN', 100],
    ['GOLDEN', 'BADGE_DIAMOND', 200],
    ['GOLDEN', 'ASSOCIATION', 200],
  ] as const)('%s %s = %i', (track, type, want) => {
    expect(examPoints(track, type)).toBe(want);
  });

  it('the mock exam carries no points, on either track', () => {
    expect(examPoints('SILVER', 'MOCK')).toBe(0);
    expect(examPoints('GOLDEN', 'MOCK')).toBe(0);
  });

  it('a tajweed exam is asked for, not suggested — the client stores a free number', () => {
    expect(examPoints('SILVER', 'TAJWEED')).toBeNull();
  });

  it('a talqeen student is worth nothing anywhere — §13.1', () => {
    expect(examPoints('TALQEEN', 'BADGE_DIAMOND')).toBe(0);
    expect(examPoints(null, 'ASSOCIATION')).toBe(0);
  });

  /* §4.7 — the doubling is a rule, not a coincidence of two hand-typed tables. */
  it('golden doubles silver on both badges', () => {
    expect(EXAM_POINTS.GOLDEN.BADGE_GOLDEN).toBe(2 * EXAM_POINTS.SILVER.BADGE_GOLDEN);
    expect(EXAM_POINTS.GOLDEN.BADGE_DIAMOND).toBe(2 * EXAM_POINTS.SILVER.BADGE_DIAMOND);
  });

  it('the association exam is equal on both tracks — it is an external exam', () => {
    expect(EXAM_POINTS.GOLDEN.ASSOCIATION).toBe(EXAM_POINTS.SILVER.ASSOCIATION);
  });
});

describe('talqeen exclusion — §4.11 / §13.1', () => {
  it('excludes talqeen and anyone without a track', () => {
    expect(earnsPoints({ track: 'TALQEEN' })).toBe(false);
    expect(earnsPoints({ track: null })).toBe(false);
  });
  it('includes both real tracks', () => {
    expect(earnsPoints({ track: 'SILVER' })).toBe(true);
    expect(earnsPoints({ track: 'GOLDEN' })).toBe(true);
  });
});

describe('balances — §4.10, the sum of the ledger and nothing else', () => {
  const rows = [
    txn('a', 10, '2026-08-01T10:00:00Z'),
    txn('a', 50, '2026-08-03T10:00:00Z'),
    txn('a', -120, '2026-08-05T10:00:00Z'),
    txn('b', 200, '2026-08-02T10:00:00Z'),
  ];

  it('sums signed deltas, and splits granted from redeemed', () => {
    const a = balances(rows).get('a')!;
    expect(a.balance).toBe(-60);
    expect(a.granted).toBe(60);
    expect(a.redeemed).toBe(120);
    expect(a.moves).toBe(3);
  });

  it('reports the newest movement regardless of insertion order', () => {
    const shuffled = [rows[2], rows[0], rows[1]];
    expect(balances(shuffled).get('a')!.lastAt).toBe('2026-08-05T10:00:00Z');
  });

  it('balanceOf agrees with the aggregate', () => {
    expect(balanceOf(rows, 'a')).toBe(balances(rows).get('a')!.balance);
    expect(balanceOf(rows, 'b')).toBe(200);
  });

  it('an unknown student has no entry rather than a zero row', () => {
    expect(balances(rows).get('zzz')).toBeUndefined();
  });

  /* «لا تُحذف حركة أبدًا. إن أخطأت، تُضيف حركة تصحيح معاكسة». */
  it('a correction row cancels the original without removing it', () => {
    const corrected = [...rows, txn('a', 120, '2026-08-06T10:00:00Z')];
    expect(balanceOf(corrected, 'a')).toBe(60);
    expect(corrected).toHaveLength(rows.length + 1);
  });
});

describe('code generation — §3.5', () => {
  const codes = generateCodes(5000);

  it('mints unique ten-character codes', () => {
    expect(new Set(codes).size).toBe(5000);
    expect(codes.every((c) => c.length === 10)).toBe(true);
  });

  it('never emits a glyph a child could misread', () => {
    expect(CODE_ALPHABET).toHaveLength(30);
    expect(codes.some((c) => /[IOU10]/.test(c))).toBe(false);
  });

  /* The reason `generateCode` rejection-samples instead of using `% 30`: a plain
     modulo over 256 makes the first sixteen symbols ~6% likelier, and that bias
     would be printed onto every card handed out. */
  it('draws every symbol at close to equal frequency', () => {
    const freq = new Map<string, number>();
    for (const c of codes) for (const ch of c) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    expect(freq.size).toBe(30);
    const counts = [...freq.values()];
    expect(Math.max(...counts) / Math.min(...counts)).toBeLessThan(1.15);
  });

  it('avoids colliding with codes that already exist', () => {
    const existing = codes.slice(0, 200);
    expect(generateCodes(200, existing).some((c) => existing.includes(c))).toBe(false);
  });

  it('prints in two groups of five and reads back through any typing noise', () => {
    expect(formatCode('ABCDE23456')).toBe('ABCDE-23456');
    expect(normaliseCode(' abcde-234 56 ')).toBe('ABCDE23456');
  });
});

describe('code state — what the student is told, and why', () => {
  it('a fresh card on a live batch is redeemable', () => {
    expect(codeState(card(), batch(), NOW)).toBe('OK');
  });

  it('a redeemed card is spent', () => {
    expect(codeState(card({ redeemedBy: 's1' }), batch(), NOW)).toBe('USED');
  });

  /* Order matters here. A card the student already spent must read USED even if
     the batch was revoked afterwards: he did nothing wrong, and telling him his
     card was cancelled would be a lie about his own history. */
  it('USED outranks REVOKED on a card that was already spent', () => {
    expect(codeState(card({ redeemedBy: 's1' }), batch({ revokedAt: '2026-08-30T00:00:00Z' }), NOW))
      .toBe('USED');
  });

  it('revoking kills an unredeemed card immediately', () => {
    expect(codeState(card(), batch({ revokedAt: '2026-08-30T00:00:00Z' }), NOW)).toBe('REVOKED');
  });

  it('expiry is checked against now, in both directions', () => {
    expect(codeState(card(), batch({ expiresAt: '2026-08-30T00:00:00Z' }), NOW)).toBe('EXPIRED');
    expect(codeState(card(), batch({ expiresAt: '2026-09-30T00:00:00Z' }), NOW)).toBe('OK');
  });

  it('an unknown code is unknown, not an error', () => {
    expect(codeState(undefined, undefined, NOW)).toBe('UNKNOWN');
  });
});

describe('batch state', () => {
  it('is active while stock remains', () => {
    expect(batchState(batch(), 5, NOW)).toBe('ACTIVE');
  });
  it('is spent at zero remaining', () => {
    expect(batchState(batch(), 0, NOW)).toBe('SPENT');
  });
  it('reports why it is dead in preference to reporting that it is empty', () => {
    expect(batchState(batch({ revokedAt: '2026-08-30T00:00:00Z' }), 0, NOW)).toBe('REVOKED');
    expect(batchState(batch({ expiresAt: '2026-08-30T00:00:00Z' }), 0, NOW)).toBe('EXPIRED');
  });
});

describe('card colour — §8, «مختلف اللون باختلاف القيمة ليسهل الفرز باليد»', () => {
  it('is stable for a value, so last month’s pile matches this month’s', () => {
    expect(cardColour(10)).toBe(cardColour(10));
  });
  it('separates the values a supervisor actually issues', () => {
    const keys = new Set([5, 10, 20, 25, 50].map((v) => cardColour(v).key));
    expect(keys.size).toBeGreaterThanOrEqual(4);
  });
});

describe('store rules — §8 (إد-٤-ج)', () => {
  const gift = (over: Partial<Gift> = {}): Gift => ({
    id: 'g1', name: 'ساعة', description: '', image: null,
    pointsCost: 100, quantity: 5, lowStockThreshold: 3,
    category: 'أخرى', status: 'VISIBLE', createdAt: '2026-08-01T00:00:00Z', ...over,
  });
  const silver = { track: 'SILVER' } as const;

  it('a visible, stocked gift a student can afford is buyable', () => {
    expect(giftAvailability(gift(), 100)).toBe('BUYABLE');
    expect(purchaseBlock(silver, gift(), 100)).toBeNull();
  });

  /* «ما لا يكفي رصيده لشرائه يظهر باهتًا مع تحتاج ٣٠ نقطة إضافية — لا يُخفى،
     ليكون حافزًا». Unaffordable is a state, not a disappearance. */
  it('an unaffordable gift is shown, and the gap is quantified', () => {
    expect(giftAvailability(gift(), 70)).toBe('CANNOT_AFFORD');
    expect(shortBy(100, 70)).toBe(30);
    expect(shortBy(100, 140)).toBe(0);
  });

  it('out of stock outranks unaffordable — there is nothing to save up for', () => {
    expect(giftAvailability(gift({ quantity: 0 }), 0)).toBe('OUT_OF_STOCK');
    expect(purchaseBlock(silver, gift({ quantity: 0 }), 1000)).toBe('OUT_OF_STOCK');
  });

  it('a hidden gift is hidden whatever its stock', () => {
    expect(giftAvailability(gift({ status: 'HIDDEN' }), 1000)).toBe('HIDDEN');
  });

  it('a talqeen student is blocked before any other question is asked', () => {
    expect(purchaseBlock({ track: 'TALQEEN' }, gift(), 10_000)).toBe('INELIGIBLE');
  });

  it('an exact balance is enough — the boundary is inclusive', () => {
    expect(purchaseBlock(silver, gift({ pointsCost: 100 }), 100)).toBeNull();
    expect(purchaseBlock(silver, gift({ pointsCost: 100 }), 99)).toBe('INSUFFICIENT_BALANCE');
  });

  describe('low stock — §8, «إذا نزلت الكمية عن رقم تحدده»', () => {
    it('fires at the threshold and below, but not above', () => {
      expect(isLowStock(gift({ quantity: 4 }))).toBe(false);
      expect(isLowStock(gift({ quantity: 3 }))).toBe(true);
      expect(isLowStock(gift({ quantity: 1 }))).toBe(true);
    });
    /* Zero is «نفدت», a different and louder message. Reporting it as merely
       low would bury the gift that actually ran out. */
    it('does not fire at zero, which is a different alert', () => {
      expect(isLowStock(gift({ quantity: 0 }))).toBe(false);
    });
    it('stays quiet for a gift that is not on display', () => {
      expect(isLowStock(gift({ quantity: 1, status: 'HIDDEN' }))).toBe(false);
    });
  });
});
