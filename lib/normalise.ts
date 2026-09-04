/* Text normalisation for matching — SPEC.md §5.1.
   We normalise only to COMPARE. The original string is always what we store. */

const DIACRITICS = /[ً-ْـ]/g;

export const collapse = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Fold alef/ya/ta-marbuta variants and strip diacritics. Matching only. */
export const foldArabic = (s: unknown) =>
  collapse(s)
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ﷴ/g, 'محمد');   // U+FDF4 ligature appears in the curriculum file

/** Ratel writes teacher fields as "1) هشام سليم" — drop the ordinal prefix. */
export const stripTeacherPrefix = (s: unknown) => collapse(s).replace(/^\d+\)\s*/, '');

/** 9 digits, no country code, no separators. */
export function normalisePhone(v: unknown): string {
  const d = String(v ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('966')) return d.slice(3);
  if (d.startsWith('0')) return d.slice(1);
  return d;
}

/** The roster stores every ID negative — an Excel artefact. abs() recovers the
    true document number (verified against Qiyas: 33 matched, 0 mismatched).
    Client instruction: import exactly as found, no length validation. */
export function normaliseNationalId(v: unknown): { id: string | null; flag: 'SHORT' | 'LONG' | null } {
  if (v === null || v === undefined || v === '') return { id: null, flag: null };
  const digits = String(v).replace(/[^\d]/g, '');
  if (!digits) return { id: null, flag: null };
  const id = String(Math.abs(Number(digits)));
  if (id.length < 10) return { id, flag: 'SHORT' };
  if (id.length > 10) return { id, flag: 'LONG' };
  return { id, flag: null };
}

/** Labels the client's sheets use as section headings inside the data. */
const SECTION_LABELS = [
  'المجموع', 'الاجمالي', 'الإجمالي', 'اسم الطالب', 'أسم الطالب',
  'متابعة الخطة', 'الاختبارات', 'التاريخ', 'المستوى', 'الحلقة',
  'البيانات الشخصية', 'اختبارات الجمعية', 'المسار', 'الصف',
];

/** A cell is a student only if it reads like a person's name.
    The dashboard workbook stacks several small tables in one sheet, so its
    section headings and its date cells sit in the same column as the names.
    Read without this guard, «متابعة الخطة» and a raw Date both became students
    and their level numbers became halaqat. */
export function isNonStudentRow(name: unknown): boolean {
  if (name instanceof Date) return true;
  const n = collapse(name);
  if (!n) return true;
  if (SECTION_LABELS.includes(n)) return true;
  if (/^\d+([.,]\d+)?$/.test(n)) return true;                 // a bare number
  if (/^[A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}\s\d{4}/.test(n)) return true;  // a stringified Date
  if (!/[؀-ۿ]/.test(n)) return true;                           // no Arabic at all
  if (n.split(' ').filter(Boolean).length < 2) return true;    // a name has parts
  return false;
}

/** Halaqa names follow the same reasoning: a level number is not a halaqa. */
export function isNonHalaqaName(name: unknown): boolean {
  if (name instanceof Date) return true;
  const n = collapse(name);
  if (!n) return true;
  if (SECTION_LABELS.includes(n)) return true;
  if (/^\d+([.,]\d+)?$/.test(n)) return true;
  if (!/[؀-ۿ]/.test(n)) return true;
  return false;
}

/** «الحسيني عبد الوهاب الحسيني السعدني» → «الحسيني السعدني».
    Arabic names run four or five parts; a narrow list only has room for the
    first and the family name. The full string stays available on hover. */
export function shortName(full: unknown): string {
  const parts = collapse(full).split(' ').filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/** A student's teacher, short form — the lookup every roster-shaped screen
    needs, kept in ONE place so the no-halaqa wording cannot drift per file. */
export function teacherName(
  halaqat: { id: string; teacher: string }[],
  halaqaId: string | null | undefined,
  fallback = '—',
): string {
  const t = halaqaId ? halaqat.find((h) => h.id === halaqaId)?.teacher : null;
  return t ? shortName(t) : fallback;
}
