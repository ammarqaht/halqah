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
