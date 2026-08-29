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

/** Rows that are not students: the totals row, blank rows, header echoes. */
export const isNonStudentRow = (name: string) =>
  !name || ['المجموع', 'الاجمالي', 'الإجمالي', 'اسم الطالب'].includes(collapse(name));

/** «الحسيني عبد الوهاب الحسيني السعدني» → «الحسيني السعدني».
    Arabic names run four or five parts; a narrow list only has room for the
    first and the family name. The full string stays available on hover. */
export function shortName(full: unknown): string {
  const parts = collapse(full).split(' ').filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
