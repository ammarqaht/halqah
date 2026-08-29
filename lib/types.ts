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
