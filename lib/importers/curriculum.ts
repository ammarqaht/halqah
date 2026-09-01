/* «منهج الحفظ.xlsx» → curriculum days. SPEC.md §5.4.

   Sheets `فضي` (3741 rows) and `ذهبي` (2161 rows), eight columns:
   المستوى · اليوم · المقرر · من سورة · آية · الى سورة · آية · ملاحظة

   Follows the importer contract in §5: parse is pure and writes nothing, and a
   preview is always shown before a commit. The parser is deliberately loud —
   this file becomes the content of every sheet a child is handed, so a level
   that arrives with 23 days is a defect to report, not to paper over. */
import * as XLSX from 'xlsx';
import type { CurriculumDay, PlanKind, Track } from '@/lib/types';
import { AR_PLAN_KIND } from '@/lib/types';
import { collapse, foldArabic } from '@/lib/normalise';

export const CURRICULUM_SHEETS: Record<string, Track> = { 'فضي': 'SILVER', 'ذهبي': 'GOLDEN' };

/** The two rows that mark an exam instead of a recitation range (§5.4). */
const EXAM_MARKERS: Record<string, 'BADGE_GOLDEN' | 'BADGE_DIAMOND'> = {
  'الوسام الذهبي': 'BADGE_GOLDEN',
  'الوسام الماسي': 'BADGE_DIAMOND',
};

/**
 * The file writes the end of a surah as «أخ» / «اخ» / «آخ» — three spellings of
 * one idea. Normalise to «آخر» and keep it TEXT: it is not an ayah number and
 * must never be coerced into one.
 */
export function normaliseAyah(v: unknown): string {
  const s = collapse(v);
  if (!s) return '';
  if (/^(أخ|اخ|آخ|آخر|اخر)$/.test(s)) return 'آخر';
  return s;
}

/** `ﷴ` (U+FDF4) appears in the curriculum file where «محمد» is meant. */
export const normaliseSurah = (v: unknown) =>
  collapse(v).replace(/ﷴ/g, 'محمد');

export type CurriculumIssue = { level: number; message: string };

export type CurriculumParse = {
  sheet: string;
  track: Track;
  days: CurriculumDay[];
  examDays: { level: number; dayNo: number; badge: string }[];
  levels: number[];
  rowCount: number;
  issues: CurriculumIssue[];
};

const HEADERS: Record<string, string> = {
  'المستوى': 'level', 'اليوم': 'day', 'المقرر': 'kind',
  'من سورة': 'fromSurah', 'الى سورة': 'toSurah', 'إلى سورة': 'toSurah',
  'ملاحظة': 'note',
};

/**
 * The sheet has TWO columns headed «آية» — one after «من سورة» and one after
 * «الى سورة». Matching by header text alone would collapse them, so position
 * settles the second one: the first «آية» is the from-ayah, the next is the to.
 */
function mapHeader(row: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  let seenAyah = 0;
  row.forEach((cell, i) => {
    const h = collapse(cell);
    if (!h) return;
    if (foldArabic(h) === foldArabic('آية')) {
      map[seenAyah === 0 ? 'fromAyah' : 'toAyah'] = i;
      seenAyah++;
      return;
    }
    const field = HEADERS[h] ?? HEADERS[collapse(h.replace(/\s+/g, ' '))];
    if (field && map[field] === undefined) map[field] = i;
  });
  return map;
}

/** Find the header row by locating «المستوى» — never assume a fixed offset. */
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if ((rows[i] ?? []).some((c) => collapse(c) === 'المستوى')) return i;
  }
  return 0;
}

export function parseCurriculumSheet(rows: unknown[][], sheet: string, track: Track): CurriculumParse {
  const headerAt = findHeaderRow(rows);
  const col = mapHeader(rows[headerAt] ?? []);

  const days: CurriculumDay[] = [];
  const examDays: CurriculumParse['examDays'] = [];
  const issues: CurriculumIssue[] = [];
  let rowCount = 0;

  for (let i = headerAt + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const level = Number(collapse(r[col.level]));
    const dayNo = Number(collapse(r[col.day]));
    if (!Number.isFinite(level) || !Number.isFinite(dayNo) || !level || !dayNo) continue;
    rowCount++;

    const fromSurahRaw = collapse(r[col.fromSurah]);
    const badge = EXAM_MARKERS[fromSurahRaw];
    if (badge) {
      /* An exam row carries no ranges — the sheet prints a date box here. */
      examDays.push({ level, dayNo, badge });
      continue;
    }

    const kind: PlanKind | undefined = AR_PLAN_KIND[collapse(r[col.kind])];
    if (!kind) continue;                       // a subtotal or a stray row

    days.push({
      track, level, dayNo, kind,
      fromSurah: normaliseSurah(r[col.fromSurah]),
      fromAyah: normaliseAyah(r[col.fromAyah]),
      toSurah: normaliseSurah(r[col.toSurah]),
      toAyah: normaliseAyah(r[col.toAyah]),
      note: collapse(r[col.note]),
    });
  }

  /* §5.4: «assert 24 days × 3 kinds for every level, or fail loudly». The
     exam days occupy two of the twenty-four and carry no rows, so a complete
     level has 22 recitation days × 3 kinds = 66 rows. Report, never repair. */
  const byLevel = new Map<number, Set<number>>();
  for (const d of days) {
    if (!byLevel.has(d.level)) byLevel.set(d.level, new Set());
    byLevel.get(d.level)!.add(d.dayNo);
  }
  for (const [level, dayset] of byLevel) {
    const examCount = examDays.filter((e) => e.level === level).length;
    const total = dayset.size + examCount;
    if (total !== 24) {
      issues.push({
        level,
        message: `المستوى ${level}: ${total} يومًا بدل ٢٤ — راجع الملف قبل الاعتماد.`,
      });
    }
  }

  return {
    sheet, track, days, examDays,
    levels: [...byLevel.keys()].sort((a, b) => b - a),
    rowCount,
    issues,
  };
}

/** Read a workbook and parse every sheet it recognises. */
export function parseCurriculumWorkbook(data: ArrayBuffer): CurriculumParse[] {
  const wb = XLSX.read(data, { type: 'array' });
  const out: CurriculumParse[] = [];
  for (const name of wb.SheetNames) {
    const track = CURRICULUM_SHEETS[collapse(name)];
    if (!track) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' });
    out.push(parseCurriculumSheet(rows, name, track));
  }
  return out;
}
