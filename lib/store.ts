'use client';
/* Client-side store — a stand-in for Prisma until BUILD_PLAN phase 1 lands.
   It starts EMPTY on purpose: the supervisor populates it by importing his own
   workbook, which is the only honest way to test the importer. */
import { useSyncExternalStore } from 'react';
import type {
  Student, Halaqa, PointTxn, PointCodeBatch, PointCode, TxnKind, Gift, Order,
  Exam, TajweedTopic,
} from './types';
import { SEED_TAJWEED_TOPIC } from './types';
import {
  earnsPoints, generateCodes, codeState, purchaseBlock, EXAM_TYPE_AR,
  type PurchaseBlock, type ExamType,
} from './points';

/** The Arabic name of an exam type, tolerant of a value the enum does not know. */
const EXAM_LABEL = (t: string) => EXAM_TYPE_AR[t as ExamType] ?? t;

export type DB = {
  students: Student[];
  halaqat: Halaqa[];
  /** Append-only. SPEC.md §3.5: never update a row, never delete one. */
  txns: PointTxn[];
  batches: PointCodeBatch[];
  codes: PointCode[];
  gifts: Gift[];
  orders: Order[];
  exams: Exam[];
  /** Admin-managed; seeded with the one topic the client records today. */
  tajweedTopics: TajweedTopic[];
  importedAt: string | null;
  sourceFile: string | null;
};

const EMPTY: DB = {
  students: [], halaqat: [], txns: [], batches: [], codes: [], gifts: [], orders: [], exams: [],
  tajweedTopics: [{ id: 'tt1', name: SEED_TAJWEED_TOPIC, active: true }],
  importedAt: null, sourceFile: null,
};
const KEY = 'halqah.db.v1';

/* An id only has to be unique inside one browser's store. When Prisma lands
   these become bigserial and this helper disappears with the module. */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

let db: DB = EMPTY;
let loaded = false;
const subs = new Set<() => void>();

function load(): DB {
  if (loaded) return db;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = { ...EMPTY, ...JSON.parse(raw) };
  } catch { /* private mode — stay in memory */ }
  return db;
}

/* Gift images pushed this store from kilobytes into megabytes, and a browser
   caps an origin near 5 MB. A silently swallowed quota error would leave the
   supervisor working against a database that stops existing at the next reload,
   so the failure is recorded and surfaced instead of shrugged off. */
let persistError: string | null = null;

function commit(next: DB) {
  db = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    persistError = null;
  } catch (e) {
    const quota = e instanceof DOMException
      && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    persistError = quota
      ? 'امتلأت مساحة المتصفح، فلم يُحفظ آخر تغيير. احذف صور هدايا لم تعد تحتاجها، أو صغّرها، ثم أعد المحاولة.'
      : 'تعذّر الحفظ في هذا المتصفح. التغييرات باقية في الذاكرة حتى تُغلق الصفحة.';
  }
  subs.forEach((f) => f());
}

export const store = {
  get: () => load(),
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },

  /* Both import paths below rewrite the roster and keep the ledger untouched.
     A student's points are his, not the spreadsheet's: re-importing a workbook
     must never wipe a balance that cards and exams have already paid out. */
  replaceAll(students: Student[], halaqat: Halaqa[], sourceFile: string) {
    const cur = load();
    commit({ ...cur, students, halaqat, importedAt: new Date().toISOString(), sourceFile });
  },
  /** Imports add and update; they never delete. SPEC.md §5.
      Two things this has to get right:
      1. Each parse mints fresh halaqa ids, so an incoming student's halaqaId
         points into ITS OWN batch. Halaqat are deduped by name, so those ids
         must be translated to the surviving halaqa or every link dangles.
      2. Identity is the national id, but two rows in one file can legitimately
         share one (the roster has such a pair). Both must survive, so the
         parser hands us a dedupeKey that disambiguates within a batch. */
  merge(students: Student[], halaqat: Halaqa[], sourceFile: string) {
    const cur = load();

    const halMap = new Map(cur.halaqat.map((h) => [h.name, h]));
    const incomingIdToName = new Map(halaqat.map((h) => [h.id, h.name]));
    for (const h of halaqat) if (!halMap.has(h.name)) halMap.set(h.name, h);
    const canonicalId = (incomingId: string | null) => {
      if (!incomingId) return null;
      const name = incomingIdToName.get(incomingId);
      return name ? halMap.get(name)!.id : incomingId;
    };

    const keyOf = (s: Student) => s.dedupeKey || s.nationalId || s.fullName;
    const byKey = new Map(cur.students.map((s) => [keyOf(s), s]));

    for (const raw of students) {
      const s: Student = { ...raw, halaqaId: canonicalId(raw.halaqaId) };
      const k = keyOf(s);
      const prev = byKey.get(k);
      if (!prev) { byKey.set(k, s); continue; }
      /* An import updates only what its file actually carries. A Ratel report
         has no «المسار» column — it must not wipe the track a roster set. */
      const patch: Partial<Student> = {};
      for (const [key, val] of Object.entries(s) as [keyof Student, unknown][]) {
        if (key === 'id') continue;
        if (val === null || val === undefined || val === '') continue;
        (patch as Record<string, unknown>)[key] = val;
      }
      byKey.set(k, { ...prev, ...patch, id: prev.id });
    }

    commit({ ...cur, students: [...byKey.values()], halaqat: [...halMap.values()],
             importedAt: new Date().toISOString(), sourceFile });
  },
  upsertHalaqa(h: Halaqa) {
    const cur = load();
    const i = cur.halaqat.findIndex((x) => x.id === h.id);
    const halaqat = i >= 0 ? cur.halaqat.map((x) => (x.id === h.id ? h : x)) : [...cur.halaqat, h];
    commit({ ...cur, halaqat });
  },
  removeHalaqa(id: string) {
    const cur = load();
    commit({ ...cur,
      halaqat: cur.halaqat.filter((h) => h.id !== id),
      students: cur.students.map((s) => (s.halaqaId === id ? { ...s, halaqaId: null } : s)) });
  },
  upsertStudent(s: Student) {
    const cur = load();
    const i = cur.students.findIndex((x) => x.id === s.id);
    const students = i >= 0 ? cur.students.map((x) => (x.id === s.id ? s : x)) : [...cur.students, s];
    commit({ ...cur, students });
  },
  /** A halaqa runs one track, so it can be set once and carried to its members. */
  setTrackForHalaqa(halaqaId: string, track: Student['track']) {
    const cur = load();
    commit({ ...cur, students: cur.students.map((s) => (s.halaqaId === halaqaId ? { ...s, track } : s)) });
  },
  /** Moving a student carries all their history — nothing resets. SPEC.md §6.3 */
  moveStudents(ids: string[], halaqaId: string | null) {
    const cur = load();
    const set = new Set(ids);
    commit({ ...cur, students: cur.students.map((s) => (set.has(s.id) ? { ...s, halaqaId } : s)) });
  },

  /* ── Points ────────────────────────────────────────────────────────────────
     SPEC.md §3.5 and the approved PDF §8. Two invariants govern everything
     below, and both are structural rather than a matter of discipline:

       1. The ledger is append-only. Nothing here updates or deletes a `txn`;
          a mistake is undone by a new, opposite row (`kind: 'CORRECTION'`), so
          the record stays truthful — «لا تُحذف حركة أبدًا».
       2. Talqeen students are outside the points system (§4.11 / §13.1). The
          guard lives HERE, at the mutation, not only on the screens, so no
          future caller can route around it. */

  /**
   * Grant — or deduct — in one movement per student. Returns what was written
   * and who was skipped, so the screen can say so plainly instead of silently
   * doing less than it was asked.
   */
  grantPoints(opts: {
    studentIds: string[];
    delta: number;
    reason: string;
    kind?: TxnKind;
    by?: string | null;
  }): { written: number; skippedTalqeen: string[] } {
    const cur = load();
    const reason = opts.reason.trim();
    if (!opts.delta || !reason) return { written: 0, skippedTalqeen: [] };

    const wanted = new Set(opts.studentIds);
    const targets = cur.students.filter((s) => wanted.has(s.id));
    const skippedTalqeen = targets.filter((s) => !earnsPoints(s)).map((s) => s.id);
    const eligible = targets.filter(earnsPoints);
    if (!eligible.length) return { written: 0, skippedTalqeen };

    const at = new Date().toISOString();
    const rows: PointTxn[] = eligible.map((s) => ({
      id: uid(),
      studentId: s.id,
      delta: opts.delta,
      kind: opts.kind ?? 'MANUAL',
      reason,
      createdBy: opts.by ?? 'المشرف',
      createdAt: at,
    }));
    commit({ ...cur, txns: [...cur.txns, ...rows] });
    return { written: rows.length, skippedTalqeen };
  },

  /** Undo a movement the honest way: an opposite row that cites the original. */
  correctTxn(txnId: string, note: string) {
    const cur = load();
    const t = cur.txns.find((x) => x.id === txnId);
    if (!t) return;
    const row: PointTxn = {
      id: uid(),
      studentId: t.studentId,
      delta: -t.delta,
      kind: 'CORRECTION',
      reason: note.trim() || `تصحيح حركة «${t.reason}»`,
      refType: null,
      refId: t.id,
      createdBy: 'المشرف',
      createdAt: new Date().toISOString(),
    };
    commit({ ...cur, txns: [...cur.txns, row] });
  },

  /** Issue a batch of printable cards. Codes are unique against every code that
      already exists, not merely against their own batch. */
  issueBatch(opts: {
    value: number;
    quantity: number;
    purpose: string;
    expiresAt?: string | null;
    by?: string | null;
  }): PointCodeBatch | null {
    const cur = load();
    const quantity = Math.floor(opts.quantity);
    if (!(opts.value > 0) || !(quantity > 0)) return null;

    const batch: PointCodeBatch = {
      id: uid(),
      value: Math.round(opts.value),
      purpose: opts.purpose.trim() || 'عام',
      quantity,
      expiresAt: opts.expiresAt || null,
      revokedAt: null,
      createdBy: opts.by ?? 'المشرف',
      createdAt: new Date().toISOString(),
    };
    const fresh = generateCodes(quantity, cur.codes.map((c) => c.code));
    const codes: PointCode[] = fresh.map((code) => ({
      id: uid(), batchId: batch.id, code, redeemedBy: null, redeemedAt: null,
    }));
    commit({ ...cur, batches: [...cur.batches, batch], codes: [...cur.codes, ...codes] });
    return batch;
  },

  /** A batch that was lost or leaked. Cards already redeemed keep their points —
      the student did nothing wrong; the unredeemed ones die on the spot. */
  revokeBatch(batchId: string) {
    const cur = load();
    commit({ ...cur, batches: cur.batches.map((b) =>
      b.id === batchId && !b.revokedAt ? { ...b, revokedAt: new Date().toISOString() } : b) });
  },

  /**
   * Redeem one card. The real system does this as a single conditional UPDATE
   * (SPEC.md §3.5) because it is the one genuine race in the product; here the
   * check and the write are one synchronous commit, which is the same guarantee
   * a single browser tab can offer. The shape of the return is the shape the
   * route handler will keep, so the portal screen does not change when the
   * database arrives.
   */
  redeemCode(rawCode: string, studentId: string):
    { ok: true; value: number; balance: number } | { ok: false; state: 'USED' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN' | 'INELIGIBLE' } {
    const cur = load();
    const student = cur.students.find((s) => s.id === studentId);
    if (!student) return { ok: false, state: 'UNKNOWN' };
    if (!earnsPoints(student)) return { ok: false, state: 'INELIGIBLE' };

    const code = cur.codes.find((c) => c.code === rawCode);
    const batch = code ? cur.batches.find((b) => b.id === code.batchId) : undefined;
    const state = codeState(code, batch);
    if (state !== 'OK') return { ok: false, state };

    const at = new Date().toISOString();
    const txn: PointTxn = {
      id: uid(),
      studentId,
      delta: batch!.value,
      kind: 'CODE',
      reason: `شحن كود — ${batch!.purpose}`,
      refType: 'code',
      refId: code!.id,
      createdBy: null,               // nobody at the keyboard but the student
      createdAt: at,
    };
    const txns = [...cur.txns, txn];
    commit({
      ...cur,
      codes: cur.codes.map((c) => (c.id === code!.id ? { ...c, redeemedBy: studentId, redeemedAt: at } : c)),
      txns,
    });
    const balance = txns.reduce((sum, t) => (t.studentId === studentId ? sum + t.delta : sum), 0);
    return { ok: true, value: batch!.value, balance };
  },


  /* ── Store — SPEC.md §3.6, approved PDF §8 (إد-٤-ج) ────────────────────────
     A gift is edited freely; an order is not. Orders are the money-like half:
     they are never deleted, their price and name are snapshotted at purchase,
     and cancelling is a compensating pair of writes rather than an undo. */

  upsertGift(g: Gift) {
    const cur = load();
    const i = cur.gifts.findIndex((x) => x.id === g.id);
    const gifts = i >= 0 ? cur.gifts.map((x) => (x.id === g.id ? g : x)) : [...cur.gifts, g];
    commit({ ...cur, gifts });
  },

  /** Removing a gift never touches the orders that bought it: they carry their
      own name and price snapshots precisely so history survives the catalogue. */
  removeGift(id: string) {
    const cur = load();
    commit({ ...cur, gifts: cur.gifts.filter((g) => g.id !== id) });
  },

  /**
   * §8, the five steps, as one indivisible act:
   * «١ الطالب يختار الهدية · ٢ النظام يتحقق من رصيده · ٣ تُخصم النقاط ·
   *  ٤ تنقص الكمية · ٥ يظهر الطلب عندك».
   *
   * Stock and balance move together or not at all — «لا يقع أحدهما دون الآخر».
   * In Postgres this is `UPDATE gifts SET quantity = quantity - 1 WHERE id = $1
   * AND quantity > 0` inside a transaction (SPEC.md §3.6); here it is one
   * synchronous commit, which is the same guarantee a single tab can give. The
   * return shape is what the route handler will keep.
   */
  purchase(studentId: string, giftId: string):
    { ok: true; order: Order } | { ok: false; block: NonNullable<PurchaseBlock> } {
    const cur = load();
    const student = cur.students.find((s) => s.id === studentId);
    const gift = cur.gifts.find((g) => g.id === giftId);
    if (!student || !gift) return { ok: false, block: 'OUT_OF_STOCK' };

    const balance = cur.txns.reduce((sum, t) => (t.studentId === studentId ? sum + t.delta : sum), 0);
    const block = purchaseBlock(student, gift, balance);
    if (block) return { ok: false, block };

    const at = new Date().toISOString();
    const order: Order = {
      id: uid(),
      number: cur.orders.reduce((max, o) => Math.max(max, o.number), 0) + 1,
      studentId,
      giftId,
      pointsSpent: gift.pointsCost,
      giftNameSnapshot: gift.name,
      status: 'PENDING',
      createdAt: at,
      deliveredAt: null,
      cancelledReason: null,
    };
    const txn: PointTxn = {
      id: uid(),
      studentId,
      delta: -gift.pointsCost,
      kind: 'PURCHASE',
      reason: `شراء — ${gift.name}`,
      refType: 'order',
      refId: order.id,
      createdBy: null,                 // the student bought it; nobody typed it
      createdAt: at,
    };
    commit({
      ...cur,
      gifts: cur.gifts.map((g) => (g.id === giftId ? { ...g, quantity: g.quantity - 1 } : g)),
      orders: [...cur.orders, order],
      txns: [...cur.txns, txn],
    });
    return { ok: true, order };
  },

  deliverOrder(orderId: string) {
    const cur = load();
    commit({ ...cur, orders: cur.orders.map((o) =>
      o.id === orderId && o.status === 'PENDING'
        ? { ...o, status: 'DELIVERED', deliveredAt: new Date().toISOString() } : o) });
  },

  /**
   * «عند الإلغاء تُعاد النقاط للطالب وتُعاد الكمية للمخزون، مع تسجيل السبب».
   * Only a PENDING order can be cancelled: once the gift is in the student's
   * hands, refunding the points would hand him both. The order is marked, never
   * deleted, and the refund is a new ledger row like every other movement.
   */
  cancelOrder(orderId: string, reason: string) {
    const cur = load();
    const o = cur.orders.find((x) => x.id === orderId);
    if (!o || o.status !== 'PENDING') return;

    const refund: PointTxn = {
      id: uid(),
      studentId: o.studentId,
      delta: o.pointsSpent,
      kind: 'REFUND',
      reason: reason.trim() ? `إلغاء طلب — ${reason.trim()}` : `إلغاء طلب «${o.giftNameSnapshot}»`,
      refType: 'order',
      refId: o.id,
      createdBy: 'المشرف',
      createdAt: new Date().toISOString(),
    };
    commit({
      ...cur,
      /* The gift may have been deleted from the catalogue since; the refund of
         points still stands, there is simply no stock row to give back to. */
      gifts: cur.gifts.map((g) => (g.id === o.giftId ? { ...g, quantity: g.quantity + 1 } : g)),
      orders: cur.orders.map((x) => (x.id === orderId
        ? { ...x, status: 'CANCELLED', cancelledReason: reason.trim() || 'دون سبب مذكور' } : x)),
      txns: [...cur.txns, refund],
    });
  },


  /* ── Exams — SPEC.md §3.4, approved PDF §9 (إد-٥-ب) ─────────────────────────
     «شاشة إدخال واحدة تُغني عن ملف الاختبارات، وتُحدّث كل الشاشات فور الحفظ».

     The one thing this must get right is the join to the ledger: «وعند التعليم
     على صُرفت تُضاف لرصيد الطالب مباشرة — لا سجلّ منفصل ولا نسيان». So the exam
     row and its points movement are written in ONE commit, never two, and the
     movement carries `refType: 'exam'` so the ledger can always point back at
     the exam that caused it. */

  /**
   * Record a new exam, or edit one already recorded (§4.12 — the supervisor may
   * edit indefinitely, there is no window after which a record locks).
   *
   * Points follow the tick, in both directions: ticking «صُرفت» writes the
   * award, and un-ticking it — or changing the amount — writes a correcting
   * movement rather than editing the first one away. The ledger stays
   * append-only, so a student's balance always reconciles against its own rows.
   */
  saveExam(exam: Exam): Exam {
    const cur = load();
    const prev = cur.exams.find((e) => e.id === exam.id) ?? null;
    const exams = prev
      ? cur.exams.map((e) => (e.id === exam.id ? exam : e))
      : [...cur.exams, exam];

    /* What the ledger has already paid out for THIS exam, from the ledger
       itself rather than from a flag — the ledger is the truth. */
    const paidSoFar = cur.txns
      .filter((t) => t.refType === 'exam' && t.refId === exam.id)
      .reduce((sum, t) => sum + t.delta, 0);

    const student = cur.students.find((s) => s.id === exam.studentId);
    const shouldHave = exam.pointsPaid && student && earnsPoints(student)
      ? exam.pointsAwarded : 0;
    const delta = shouldHave - paidSoFar;

    const txns = [...cur.txns];
    if (delta !== 0) {
      txns.push({
        id: uid(),
        studentId: exam.studentId,
        delta,
        kind: delta > 0 ? 'EXAM' : 'CORRECTION',
        reason: delta > 0
          ? `اجتياز — ${exam.type === 'TAJWEED' && exam.tajweedTopic ? exam.tajweedTopic : EXAM_LABEL(exam.type)}`
          : `تعديل نقاط اختبار — ${EXAM_LABEL(exam.type)}`,
        refType: 'exam',
        refId: exam.id,
        createdBy: 'المشرف',
        createdAt: new Date().toISOString(),
      });
    }
    commit({ ...cur, exams, txns });
    return exam;
  },

  /** Topics the supervisor adds himself, «دون أن نعدّل النظام». */
  upsertTajweedTopic(topic: TajweedTopic) {
    const cur = load();
    const i = cur.tajweedTopics.findIndex((t) => t.id === topic.id);
    const tajweedTopics = i >= 0
      ? cur.tajweedTopics.map((t) => (t.id === topic.id ? topic : t))
      : [...cur.tajweedTopics, topic];
    commit({ ...cur, tajweedTopics });
  },

  reset() { commit(EMPTY); },

  /** Non-null when the last write could not reach `localStorage`. */
  persistError: () => persistError,
};

export function useDB(): DB {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
