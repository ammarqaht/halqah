/* Domain types — SPEC.md §1 (glossary) and §3.1 (schema). */
export type Track = 'TALQEEN' | 'SILVER' | 'GOLDEN';
export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED';
export type IdFlag = 'SHORT' | 'LONG' | 'DUPLICATE' | null;

export const TRACK_AR: Record<Track, string> = { TALQEEN: 'تلقين', SILVER: 'فضي', GOLDEN: 'ذهبي' };
export const AR_TRACK: Record<string, Track> = { 'تلقين': 'TALQEEN', 'فضي': 'SILVER', 'ذهبي': 'GOLDEN' };
export const STATUS_AR: Record<StudentStatus, string> = {
  ACTIVE: 'نشط', INACTIVE: 'منقطع', GRADUATED: 'متخرّج',
};

export type Halaqa = {
  id: string;
  name: string;        // «تحفيظ حسن محمد ماهر علي (العصر)»
  teacher: string;
  mosque: string;
  timeSlot: string;    // العصر · المغرب …
  /** A halaqa normally runs one track. Set here, it can be applied to every
      student in it at once instead of one by one. */
  track?: Track | null;
  notes?: string;
};

export type Student = {
  id: string;
  fullName: string;
  nationalId: string | null;
  nationalIdFlag: IdFlag;
  track: Track | null;
  halaqaId: string | null;   // null ⇒ «طالب بلا حلقة» → alert
  grade: string;
  stage: string;
  nationality: string;
  guardianPhone: string;
  status: StudentStatus;
  currentLevel: number | null;
  /** Stable identity across re-imports. Normally the national id; suffixed when
      one file legitimately carries the same id on two different rows. */
  dedupeKey?: string;
  // last Ratel snapshot
  attended?: boolean;
  hifzPages?: number;
  reviewPages?: number;
};

/** Nationalities the client's own files already contain. The list grows —
    whatever the supervisor types once is offered from then on. */
export const BASE_NATIONALITIES = [
  'سعودي', 'يمني', 'سوداني', 'مصري', 'سوري', 'أردني', 'فلسطيني',
  'باكستاني', 'هندي', 'بنغلاديشي', 'نيجيري', 'تشادي', 'أخرى',
];

/** School stages, and the grades that belong to each. Derived from the client's
    own roster: the young ones sit under «تلقين» (التمهيدي and the first three
    primary years), while «ابتدائي» in his file carries the older primary years.
    We offer all six there, since he asked for أول…سادس. */
export const STAGES = ['تلقين', 'ابتدائي', 'متوسط', 'ثانوي'] as const;

export const GRADES_BY_STAGE: Record<string, string[]> = {
  'تلقين':   ['التمهيدي', 'أول ابتدائي', 'ثاني ابتدائي', 'ثالث ابتدائي'],
  'ابتدائي': ['أول ابتدائي', 'ثاني ابتدائي', 'ثالث ابتدائي', 'رابع ابتدائي', 'خامس ابتدائي', 'سادس ابتدائي'],
  'متوسط':   ['أول متوسط', 'ثاني متوسط', 'ثالث متوسط'],
  'ثانوي':   ['أول ثانوي', 'ثاني ثانوي', 'ثالث ثانوي'],
};

export const ALL_GRADES = [...new Set(Object.values(GRADES_BY_STAGE).flat())];

/* ── Points — SPEC.md §3.5, requirements PDF §8 (إد-٤-أ · إد-٤-ب) ─────────────
   The ledger is append-only. A balance is never a stored number: it is the sum
   of its movements, so it cannot drift from its own record («الرصيد ليس رقمًا
   مخزَّنًا، بل مجموع الحركات»). A mistake is corrected by a new, opposite row. */

export type TxnKind = 'MANUAL' | 'CODE' | 'EXAM' | 'PURCHASE' | 'REFUND' | 'CORRECTION';

export const TXN_KIND_AR: Record<TxnKind, string> = {
  MANUAL: 'يدوي', CODE: 'كود', EXAM: 'اختبار',
  PURCHASE: 'شراء', REFUND: 'استرجاع', CORRECTION: 'تصحيح',
};

/** The reason list the client dictated, §8: «اختبار · حضور · تسميع · مسابقة ·
    مكافأة خاصة · أخرى». It is required — it is what makes the reports useful. */
export const POINT_REASONS = ['اختبار', 'حضور', 'تسميع', 'مسابقة', 'مكافأة خاصة', 'أخرى'] as const;

/** What a printed card is handed out for, §8 (إد-٤-ب). Free text is allowed. */
export const CODE_PURPOSES = ['حضور', 'تسميع', 'اختبار', 'عام'] as const;

export type PointTxn = {
  id: string;
  studentId: string;
  /** Signed. Deductions are negative rows, never edits to an earlier one. */
  delta: number;
  kind: TxnKind;
  reason: string;
  refType?: 'exam' | 'order' | 'code' | null;
  refId?: string | null;
  /** null ⇒ the student redeemed a card himself, with nobody at the keyboard. */
  createdBy: string | null;
  createdAt: string;
};

export type PointCodeBatch = {
  id: string;
  value: number;
  purpose: string;
  quantity: number;
  expiresAt: string | null;
  /** Revoking a batch kills every card of it that has not been redeemed yet. */
  revokedAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type PointCode = {
  id: string;
  batchId: string;
  /** Ten characters, random — never sequential, or the next card is guessable. */
  code: string;
  redeemedBy: string | null;
  redeemedAt: string | null;
};

/* ── Store — SPEC.md §3.6, requirements PDF §8 (إد-٤-ج) ───────────────────────
   The gift is the reason the points exist. «الخصم تلقائي وفوري، ولا يمكن
   للطالب الشراء برصيد لا يكفي» — so a purchase is one indivisible act: check
   the balance, take the stock, write the order, write the movement. */

export type GiftStatus = 'VISIBLE' | 'HIDDEN';
export type OrderStatus = 'PENDING' | 'DELIVERED' | 'CANCELLED';

export const GIFT_STATUS_AR: Record<GiftStatus, string> = { VISIBLE: 'معروضة', HIDDEN: 'مخفيّة' };
export const ORDER_STATUS_AR: Record<OrderStatus, string> = {
  PENDING: 'بانتظار التسليم', DELIVERED: 'سُلِّمت', CANCELLED: 'ملغاة',
};

/** Categories order the shop in front of the student, §8. Free text; these are
    only what the first supervisor is offered before he types his own. */
export const GIFT_CATEGORIES = ['أدوات مدرسية', 'ألعاب', 'كتب', 'إلكترونيات', 'حلويات', 'أخرى'] as const;

export type Gift = {
  id: string;
  name: string;
  description: string;
  /** A data URL until CranL's S3 bucket exists — see `lib/image.ts` for the
      downscaling that keeps a browser store from filling up. */
  image: string | null;
  pointsCost: number;
  quantity: number;
  /** Below this, the overview raises «هدية قاربت على النفاد». */
  lowStockThreshold: number;
  category: string;
  status: GiftStatus;
  createdAt: string;
};

export type Order = {
  id: string;
  /** Short, human, and quotable at the desk: «رقم طلبي ٧٣». */
  number: number;
  studentId: string;
  giftId: string;
  /** Snapshots. The gift's price and name may change; what he paid may not. */
  pointsSpent: number;
  giftNameSnapshot: string;
  status: OrderStatus;
  createdAt: string;
  deliveredAt: string | null;
  cancelledReason: string | null;
};
