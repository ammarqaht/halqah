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

/* ── Exams — SPEC.md §3.4, requirements PDF §9 (إد-٥-ب · إد-٥-ج) ──────────────
   «شاشة إدخال واحدة تُغني عن ملف الاختبارات، وتُحدّث كل الشاشات فور الحفظ». */

export type ExamSource = 'MANUAL' | 'QIYAS_IMPORT' | 'ONSITE';

export const EXAM_SOURCE_AR: Record<ExamSource, string> = {
  MANUAL: 'إدخال يدوي', QIYAS_IMPORT: 'استيراد من قياس', ONSITE: 'اختبار على الشاشة',
};

/** The reasons the client's own sheet records for a manual grant of points. */
export type Exam = {
  id: string;
  studentId: string;
  /** Denormalised at the time of the exam — a student may move halaqa later,
      and the record of who examined him must not move with him. */
  halaqaId: string | null;
  track: Track | null;
  type: string;                    // ExamType from lib/points.ts
  takenOn: string;                 // ISO date
  /** The student's level at the moment of the exam, so we know later which
      levels he has actually been examined on. */
  level: number | null;
  ajza: number | null;
  errors: number | null;
  warnings: number | null;
  tajweedErrors: number | null;
  score: number | null;            // out of 100
  passed: boolean | null;
  pointsAwarded: number;
  /** «نقاط تحفيز» — the tick in the client's sheet. Points reach the ledger
      only when this is true, and the ledger row is written with the exam. */
  pointsPaid: boolean;
  note: string;
  examiner: string;
  tajweedTopic: string | null;
  source: ExamSource;
  createdAt: string;
};

/** §9: «تُضيفون أنواعًا أخرى بأنفسكم من الإعدادات … دون أن نعدّل النظام». */
export type TajweedTopic = { id: string; name: string; active: boolean };

export const SEED_TAJWEED_TOPIC = 'النون الساكنة والتنوين';

/* ── Curriculum & plans — SPEC.md §3.2/§3.3, PDF §9 (إد-٥-أ) ──────────────────
   The curriculum is reference data, loaded once from «منهج الحفظ.xlsx» and
   rarely touched. A student's plan is a THIN layer over it: the plan records
   which level was issued and when, and only the days that differ from the
   curriculum are stored. That is what makes «لا يُفقد الأصل أبدًا» true —
   deleting the overrides restores the original, because the original was never
   overwritten. */

export type PlanKind = 'DARS' | 'MURAJAA_SUGHRA' | 'MURAJAA_KUBRA';

export const PLAN_KIND_AR: Record<PlanKind, string> = {
  DARS: 'درس', MURAJAA_SUGHRA: 'م.ص', MURAJAA_KUBRA: 'م.ك',
};

/** The order they appear in on the printed sheet, top to bottom. */
export const PLAN_KIND_ORDER: PlanKind[] = ['MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS'];

export const AR_PLAN_KIND: Record<string, PlanKind> = {
  'درس': 'DARS', 'م.ص': 'MURAJAA_SUGHRA', 'م.ك': 'MURAJAA_KUBRA',
};

export type CurriculumDay = {
  track: Track;
  level: number;
  dayNo: number;                   // 1..24 by default
  kind: PlanKind;
  /** Text, not numbers: the file carries «آخر» for the end of a surah. */
  fromSurah: string;
  fromAyah: string;
  toSurah: string;
  toAyah: string;
  note: string;
};

/** «الوسام الذهبي» on day 12, «الوسام الماسي» on day 24 — these rows carry a
    date box on the sheet, not a memorisation range (§9). Movable per plan. */
export type ExamDayMap = { BADGE_GOLDEN: number; BADGE_DIAMOND: number };

export type StudentPlan = {
  id: string;
  studentId: string;
  track: Track;
  level: number;
  /** «متى أعطيته الورقة» — written by the act of printing, and what the
      «تأخّر في مستواه» alert measures from. */
  issuedAt: string;
  issuedBy: string | null;
  /** How many working days this student's sheet runs to. 24 unless edited. */
  dayCount: number;
  examDays: ExamDayMap;
  /** Half a page for Silver, a page for Golden — overridable per student
      «لطالب يحتاج تخفيفًا أو زيادة عن مقرّر مساره المعتاد». */
  dailyAmount: string;
  printedCount: number;
  createdAt: string;
};

/** Only the rows that DIFFER from the curriculum. One per (day, kind). */
export type PlanDayOverride = {
  planId: string;
  dayNo: number;
  kind: PlanKind;
  fromSurah: string;
  fromAyah: string;
  toSurah: string;
  toAyah: string;
  note: string;
};

/* ── On-site exam — SPEC.md §3.4, PDF §9 (إد-٥-ج) ─────────────────────────────
   The two sheets the client keeps today, «حجز اختبار» and «صفحة الاختبار»,
   moved onto the screen. And the sentence that governs the whole feature:
   «النظام لا يصحّح التسميع — أنتم من يستمع ويحكم. دور النظام أن يعدّ الأخطاء
   ويحسب الدرجة ويحفظ النتيجة، بدل الورقة والقلم والآلة الحاسبة.» */

export type BookingStatus = 'BOOKED' | 'DONE' | 'CANCELLED';

export const BOOKING_STATUS_AR: Record<BookingStatus, string> = {
  BOOKED: 'محجوز', DONE: 'أُجري', CANCELLED: 'أُلغي',
};

/** «تُسجّل من سيُختبر ومتى وفي أي مستوى ولأي وسام». */
export type ExamBooking = {
  id: string;
  studentId: string;
  /** ISO date — the day's list is built from this. */
  scheduledOn: string;
  level: number | null;
  /** Only the two badges are sat on screen; the association exam is external. */
  badge: 'BADGE_GOLDEN' | 'BADGE_DIAMOND';
  status: BookingStatus;
  /** Set once the sheet is approved and an exam record exists. */
  examId: string | null;
  note: string;
  createdAt: string;
};

/**
 * One row of the on-site sheet.
 *
 * `examId` holds the BOOKING's id while the sheet is still a draft — an exam
 * that was never sat must not exist as a record — and `approveBooking` rewrites
 * every row to the real exam id in the same commit. That keeps SPEC §3.4's
 * single `exam_id` column and still lets the supervisor close the laptop
 * mid-exam without losing his counters.
 */
export type ExamQuestion = {
  id: string;
  examId: string;
  seq: number;
  /** «السورة، ويمكن معها رقم الآية» — kept so the same passages are not set
      again next time: «ألّا تُعيد عليه المواضع نفسها في اختباره القادم». */
  surah: string;
  ayahFrom: string;
  ayahTo: string;
  errors: number;
  warnings: number;
  tajweedErrors: number;
  note: string;
};

/** Levels count DOWN: Silver 60→1, Golden 30→1. Talqeen has none — it is a
    classification, not a curriculum (القرار المعتمد ١). */
export const LEVEL_MAX: Record<Track, number | null> = {
  SILVER: 60, GOLDEN: 30, TALQEEN: null,
};

export function levelsFor(track: Track | null): number[] {
  const max = track ? LEVEL_MAX[track] : null;
  if (!max) return [];
  return Array.from({ length: max }, (_, i) => max - i);
}
