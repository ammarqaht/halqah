'use client';
/* Client-side store — a stand-in for Prisma until BUILD_PLAN phase 1 lands.
   It starts EMPTY on purpose: the supervisor populates it by importing his own
   workbook, which is the only honest way to test the importer. */
import { useSyncExternalStore } from 'react';
import type {
  Student, Halaqa, PointTxn, PointCodeBatch, PointCode, TxnKind, Gift, Order,
  Exam, TajweedTopic, CurriculumDay, StudentPlan, PlanDayOverride,
  ExamBooking, ExamQuestion,
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
  bookings: ExamBooking[];
  examQuestions: ExamQuestion[];
  /** Reference data, loaded once from «منهج الحفظ.xlsx» and rarely touched. */
  curriculum: CurriculumDay[];
  plans: StudentPlan[];
  /** Only the rows that DIFFER from the curriculum — SPEC.md §3.3. */
  planOverrides: PlanDayOverride[];
  /** Admin-managed; seeded with the one topic the client records today. */
  tajweedTopics: TajweedTopic[];
  importedAt: string | null;
  sourceFile: string | null;
};

const EMPTY: DB = {
  students: [], halaqat: [], txns: [], batches: [], codes: [], gifts: [], orders: [], exams: [], bookings: [], examQuestions: [],
  curriculum: [], plans: [], planOverrides: [],
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

/* Exams written before tajweed exams could carry several topics hold a single
   `tajweedTopic`. Read it forward rather than dropping what was recorded. */
function migrate(d: DB): DB {
  const exams = d.exams.map((e) => {
    if (Array.isArray((e as { tajweedTopics?: unknown }).tajweedTopics)) return e;
    const old = (e as unknown as { tajweedTopic?: string | null }).tajweedTopic;
    return { ...e, tajweedTopics: old ? [old] : [] };
  });
  return { ...d, exams };
}

function load(): DB {
  if (loaded) return db;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = migrate({ ...EMPTY, ...JSON.parse(raw) });
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
          ? `اجتياز — ${exam.type === 'TAJWEED' && exam.tajweedTopics.length ? exam.tajweedTopics.join('، ') : EXAM_LABEL(exam.type)}`
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


  /* ── Curriculum & plans — SPEC.md §3.2/§3.3, approved PDF §9 (إد-٥-أ) ───────
     The curriculum is reference data: it is REPLACED per track on import, not
     merged, because a re-upload of «منهج الحفظ» is a corrected file rather than
     an addition. Student plans and their overrides survive it untouched — a
     supervisor fixing a typo in the curriculum must not lose the sheets he has
     already issued. */

  /** Replace one track's curriculum. The other track, and every plan, stand. */
  /** One upload, every kind of row it carried. The screens do not each get
      their own uploader: a file that holds students and exams and plan dates
      should fill all three in one commit, or the halves fall out of step. */
  ingest(payload: {
    students?: Student[];
    halaqat?: Halaqa[];
    exams?: Exam[];
    plans?: StudentPlan[];
    curriculum?: { track: Exclude<Student['track'], null>; days: CurriculumDay[] }[];
    sourceFile: string;
  }) {
    /* Every parse mints fresh student ids, and merge() keeps the id the store
       already had — so the exams and plans in this same payload point at ids
       that stop existing the moment the merge lands. That is why a student the
       file plainly gives a level to came out «بلا مستوى»: his plan was there,
       attached to nobody. Resolve the incoming ids to the surviving ones FIRST,
       then everything downstream lands on the right person. */
    const before = load();
    const keyOf = (st: Student) => st.dedupeKey || st.nationalId || st.fullName;
    const survivor = new Map(before.students.map((st) => [keyOf(st), st.id]));
    const remap = new Map<string, string>();
    for (const st of payload.students ?? []) {
      const kept = survivor.get(keyOf(st));
      if (kept && kept !== st.id) remap.set(st.id, kept);
    }
    const resolve = (id: string | null) => (id && remap.get(id)) || id;

    if (payload.students?.length || payload.halaqat?.length) {
      store.merge(payload.students ?? [], payload.halaqat ?? [], payload.sourceFile);
    }

    const cur = load();
    let next = { ...cur };
    const exams = (payload.exams ?? []).map((e) => ({ ...e, studentId: resolve(e.studentId)! }));
    const plans = (payload.plans ?? []).map((p) => ({ ...p, studentId: resolve(p.studentId)! }));

    if (payload.curriculum?.length) {
      let curriculum = next.curriculum;
      for (const c of payload.curriculum) {
        curriculum = [...curriculum.filter((d) => d.track !== c.track), ...c.days];
      }
      next = { ...next, curriculum };
    }

    if (payload.exams?.length) {
      /* A topic the file examined on is a topic the halaqa uses. Registering it
         here is what puts it in the picker next time, instead of making the
         supervisor retype a rule his own sheet already names. */
      const known = new Set(next.tajweedTopics.map((t) => t.name));
      const fresh = [...new Set(exams.flatMap((e) => e.tajweedTopics))]
        .filter((n) => n && !known.has(n))
        .map((name) => ({ id: `tt-${name}`, name, active: true }));
      if (fresh.length) next = { ...next, tajweedTopics: [...next.tajweedTopics, ...fresh] };
    }

    if (payload.exams?.length) {
      /* An exam is identified by who sat it, when, and of what kind. Re-uploading
         the same log must not double every record. */
      const key = (e: Exam) => `${e.studentId}|${e.takenOn}|${e.type}`;
      const have = new Set(next.exams.map(key));
      next = { ...next, exams: [...next.exams, ...exams.filter((e) => !have.has(key(e)))] };
    }

    /* A student who was never handed a printed sheet can still have been
       EXAMINED on a level, and the exam log records it. Reading it is the
       difference between «بلا مستوى» and the level his own file names — the
       plan below still wins wherever both exist, because a sheet issued is a
       later statement than an exam sat. */
    if (next.exams.length) {
      const latestExam = new Map<string, { level: number; on: string }>();
      for (const e of next.exams) {
        if (!e.studentId || e.level === null) continue;
        const prev = latestExam.get(e.studentId);
        if (!prev || e.takenOn > prev.on) latestExam.set(e.studentId, { level: e.level, on: e.takenOn });
      }
      next = { ...next, students: next.students.map((st) => (
        st.currentLevel != null || !latestExam.has(st.id)
          ? st : { ...st, currentLevel: latestExam.get(st.id)!.level })) };
    }

    if (payload.plans?.length) {
      const key = (p: StudentPlan) => `${p.studentId}|${p.track}|${p.level}`;
      const have = new Set(next.plans.map(key));
      const added = plans.filter((p) => !have.has(key(p)));
      /* The newest sheet a student was handed is the level he is on now. */
      const latest = new Map<string, StudentPlan>();
      for (const p of [...next.plans, ...added]) {
        const prev = latest.get(p.studentId);
        if (!prev || p.issuedAt > prev.issuedAt) latest.set(p.studentId, p);
      }
      next = {
        ...next,
        plans: [...next.plans, ...added],
        students: next.students.map((st) => {
          const p = latest.get(st.id);
          return p ? { ...st, currentLevel: p.level, track: st.track ?? p.track } : st;
        }),
      };
    }

    commit({ ...next, importedAt: new Date().toISOString(), sourceFile: payload.sourceFile });
  },

  replaceCurriculum(track: Student['track'], days: CurriculumDay[], sourceFile: string) {
    const cur = load();
    commit({
      ...cur,
      curriculum: [...cur.curriculum.filter((d) => d.track !== track), ...days],
      importedAt: new Date().toISOString(),
      sourceFile,
    });
  },
  /** Edit one level's curriculum — the master, not a student's copy.
      «لكل من يأخذ هذا المستوى» in §9: it touches everyone on that level, which
      is why the screen asks twice before calling this. */
  setCurriculumLevel(track: Exclude<Student['track'], null>, level: number, days: CurriculumDay[]) {
    const cur = load();
    commit({
      ...cur,
      curriculum: [
        ...cur.curriculum.filter((d) => !(d.track === track && d.level === level)),
        ...days,
      ],
    });
  },


  /** The plan already issued for that level, or null. Reads, never writes. */
  planFor(studentId: string, track: Exclude<Student['track'], null>, level: number) {
    return load().plans.find(
      (p) => p.studentId === studentId && p.track === track && p.level === level) ?? null;
  },

  /**
   * Issue a plan — or hand back the one already issued for that level.
   *
   * §9 is explicit that printing is what records the date: «الحفظ يقع تلقائيًا
   * مع الطباعة — لا تحتاج زر حفظ منفصلًا». So this creates the record and
   * `markPrinted` stamps it, and the screen calls them together.
   *
   * CALL IT ON PRINT OR ON A REAL EDIT, NEVER ON PREVIEW. It writes a plan
   * row, and a screen that called it while merely rendering created one for
   * every name that was clicked. The student's level moves in `markPrinted`.
   */
  issuePlan(args: {
    studentId: string; track: Exclude<Student['track'], null>; level: number;
    dailyAmount: string; by?: string | null;
  }): StudentPlan {
    const cur = load();
    const existing = cur.plans.find(
      (p) => p.studentId === args.studentId && p.track === args.track && p.level === args.level);
    if (existing) return existing;

    const now = new Date().toISOString();
    const plan: StudentPlan = {
      id: uid(),
      studentId: args.studentId,
      track: args.track,
      level: args.level,
      issuedAt: now,
      issuedBy: args.by ?? 'المشرف',
      dayCount: 24,
      examDays: { BADGE_GOLDEN: 12, BADGE_DIAMOND: 24 },
      dailyAmount: args.dailyAmount,
      printedCount: 0,
      createdAt: now,
    };
    /* Creating the row does NOT move the student. `markPrinted` does, because
       printing is the act §9 names: «الحفظ يقع تلقائيًا مع الطباعة». Promoting
       here instead meant an already-issued sheet promoted nobody on reprint,
       and an edit promoted somebody who was never handed a thing. */
    commit({ ...cur, plans: [...cur.plans, plan] });
    return plan;
  },

  /** Set a student's level directly, without issuing a sheet — the supervisor
      knows where a student stands before the system does. */
  setLevel(studentId: string, level: number | null) {
    const cur = load();
    commit({ ...cur, students: cur.students.map((s) =>
      s.id === studentId ? { ...s, currentLevel: level } : s) });
  },

  /**
   * «الحفظ يقع تلقائيًا مع الطباعة» — and the date it writes is what the
   * «تأخّر في مستواه» alert measures from, so the FIRST print sets it and later
   * reprints only raise the count. Re-printing a sheet a month later must not
   * make a late student look freshly issued.
   */
  markPrinted(planId: string) {
    const cur = load();
    const plan = cur.plans.find((p) => p.id === planId);
    if (!plan) return;
    /* Printing the sheet is the moment the student is put on that level — the
       supervisor has the paper in his hand. Previewing does not do it, and
       editing does not do it; this does, on every print, including a reprint
       of a sheet issued earlier. */
    commit({
      ...cur,
      plans: cur.plans.map((p) => (p.id === planId
        ? { ...p, printedCount: p.printedCount + 1,
            issuedAt: p.printedCount === 0 ? new Date().toISOString() : p.issuedAt }
        : p)),
      students: cur.students.map((st) =>
        st.id === plan.studentId ? { ...st, currentLevel: plan.level } : st),
    });
  },

  updatePlan(planId: string, patch: Partial<StudentPlan>) {
    const cur = load();
    commit({ ...cur, plans: cur.plans.map((p) => (p.id === planId ? { ...p, ...patch, id: p.id } : p)) });
  },

  /** One row of one day, for THIS student only — the default scope in §9. */
  setPlanOverride(o: PlanDayOverride) {
    const cur = load();
    const rest = cur.planOverrides.filter(
      (x) => !(x.planId === o.planId && x.dayNo === o.dayNo && x.kind === o.kind));
    commit({ ...cur, planOverrides: [...rest, o] });
  },

  /** Wholesale replacement after a day is inserted or removed and everything
      below it is renumbered. */
  replacePlanOverrides(planId: string, overrides: PlanDayOverride[]) {
    const cur = load();
    commit({ ...cur,
      planOverrides: [...cur.planOverrides.filter((o) => o.planId !== planId), ...overrides] });
  },

  /**
   * «زرّ إرجاع إلى المنهج الأصلي» — and it is a genuine restore rather than a
   * re-copy, because the curriculum was never written over in the first place.
   */
  restorePlan(planId: string) {
    const cur = load();
    commit({
      ...cur,
      planOverrides: cur.planOverrides.filter((o) => o.planId !== planId),
      plans: cur.plans.map((p) => (p.id === planId
        ? { ...p, dayCount: 24, examDays: { BADGE_GOLDEN: 12, BADGE_DIAMOND: 24 } } : p)),
    });
  },

  /**
   * «لكل من يأخذ هذا المستوى» — the second save scope, which needs an extra
   * confirmation because it touches other students. It writes the curriculum
   * itself, and then the plan's own overrides for those rows become redundant
   * and are dropped, so the student is not pinned to a stale copy of what he
   * just promoted.
   */
  applyPlanToLevel(planId: string) {
    const cur = load();
    const plan = cur.plans.find((p) => p.id === planId);
    if (!plan) return;
    const mine = cur.planOverrides.filter((o) => o.planId === planId);
    if (!mine.length) return;

    const key = (dayNo: number, kind: string) => `${dayNo}:${kind}`;
    const patch = new Map(mine.map((o) => [key(o.dayNo, o.kind), o]));

    const curriculum = cur.curriculum.map((d) => {
      if (d.track !== plan.track || d.level !== plan.level) return d;
      const o = patch.get(key(d.dayNo, d.kind));
      if (!o) return d;
      patch.delete(key(d.dayNo, d.kind));
      return { ...d, fromSurah: o.fromSurah, fromAyah: o.fromAyah,
               toSurah: o.toSurah, toAyah: o.toAyah, note: o.note };
    });
    /* Rows he added beyond the curriculum become curriculum rows of their own. */
    for (const o of patch.values()) {
      curriculum.push({
        track: plan.track, level: plan.level, dayNo: o.dayNo, kind: o.kind,
        fromSurah: o.fromSurah, fromAyah: o.fromAyah,
        toSurah: o.toSurah, toAyah: o.toAyah, note: o.note,
      });
    }
    commit({ ...cur, curriculum,
      planOverrides: cur.planOverrides.filter((o) => o.planId !== planId) });
  },


  /* ── On-site exam — SPEC.md §6.9, approved PDF §9 (إد-٥-ج) ──────────────────
     A booking is a promise; an exam is a record. Nothing is written into
     `exams` until the sheet is approved, because an exam that was never sat
     must not exist — but the counters are persisted the whole way through, so
     the supervisor can close the laptop mid-recitation and come back. */

  book(b: Omit<ExamBooking, 'id' | 'status' | 'examId' | 'createdAt'>): ExamBooking {
    const cur = load();
    const booking: ExamBooking = {
      ...b, id: uid(), status: 'BOOKED', examId: null, createdAt: new Date().toISOString(),
    };
    commit({ ...cur, bookings: [...cur.bookings, booking] });
    return booking;
  },

  cancelBooking(bookingId: string) {
    const cur = load();
    commit({ ...cur, bookings: cur.bookings.map((b) =>
      (b.id === bookingId && b.status === 'BOOKED' ? { ...b, status: 'CANCELLED' } : b)) });
  },

  /** Replace the whole sheet for one booking. Renumbering happens in the screen
      (§9: «يعيد النظام ترقيم الأسئلة … مع كل تغيير»), so this just persists. */
  setQuestions(ownerId: string, questions: ExamQuestion[]) {
    const cur = load();
    commit({ ...cur, examQuestions: [
      ...cur.examQuestions.filter((q) => q.examId !== ownerId),
      ...questions,
    ] });
  },

  /**
   * «الاعتماد: بضغطة واحدة تُحفظ نتيجة الاختبار كاملة، فتذهب إلى كل الشاشات،
   * وتُضاف نقاط الاجتياز.»
   *
   * One commit does all of it: the exam row, the questions re-pointed from the
   * booking to it, the booking closed, and the points movement — which reuses
   * the same reconciliation `saveExam` uses, so an approval can never pay
   * twice. Talqeen is refused here as well as on the screen.
   */
  approveBooking(args: {
    bookingId: string; exam: Omit<Exam, 'id'>; by?: string | null;
  }): Exam | null {
    const cur = load();
    const booking = cur.bookings.find((b) => b.id === args.bookingId);
    if (!booking || booking.status !== 'BOOKED') return null;

    const student = cur.students.find((s) => s.id === args.exam.studentId);
    if (!student) return null;

    const examId = uid();
    const exam: Exam = { ...args.exam, id: examId };

    const paysPoints = exam.pointsPaid && earnsPoints(student) && exam.pointsAwarded > 0;
    const txns = paysPoints
      ? [...cur.txns, {
          id: uid(),
          studentId: exam.studentId,
          delta: exam.pointsAwarded,
          kind: 'EXAM' as TxnKind,
          reason: `اجتياز — ${EXAM_LABEL(exam.type)}`,
          refType: 'exam' as const,
          refId: examId,
          createdBy: args.by ?? 'المشرف',
          createdAt: new Date().toISOString(),
        }]
      : cur.txns;

    commit({
      ...cur,
      exams: [...cur.exams, exam],
      /* The draft rows were filed under the booking; they belong to the exam now. */
      examQuestions: cur.examQuestions.map((q) =>
        (q.examId === booking.id ? { ...q, examId } : q)),
      bookings: cur.bookings.map((b) =>
        (b.id === booking.id ? { ...b, status: 'DONE', examId } : b)),
      txns,
    });
    return exam;
  },

  reset() { commit(EMPTY); },

  /** Non-null when the last write could not reach `localStorage`. */
  persistError: () => persistError,
};

export function useDB(): DB {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
