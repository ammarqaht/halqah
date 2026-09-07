/* Exam records, from two different sheets that mean the same thing.
     · «قياس»       — the association's own export, results only
     · «الاختبارات» — the supervisor's own log, with error counters

   Both land in one place. Neither carries a student id we can trust, so both
   match by national id first and by folded name second, and anything that
   matches nothing is handed back rather than guessed at. */
import * as XLSX from 'xlsx';
import type { Student, Exam } from '@/lib/types';
import { collapse, foldArabic, normaliseNationalId } from '@/lib/normalise';
import type { ExamType } from '@/lib/points';

const uid = () => Math.random().toString(36).slice(2, 10);

/** The client writes exam types in prose. These are the forms his files use. */
const TYPE_BY_TEXT: [RegExp, ExamType][] = [
  [/الوسام\s*الماسي|ماسي/, 'BADGE_DIAMOND'],
  [/الوسام\s*الذهبي|ذهبي/, 'BADGE_GOLDEN'],
  [/الجمعية|جمعية/, 'ASSOCIATION'],
  [/تجريب|بروفة|تلقين/, 'MOCK'],
  [/تجويد|النون\s*الساكنة|المدود|الإدغام|القلقلة/, 'TAJWEED'],
];

export function examTypeFrom(text: unknown, fallback: ExamType = 'ASSOCIATION'): ExamType {
  const t = collapse(text);
  for (const [re, kind] of TYPE_BY_TEXT) if (re.test(t)) return kind;
  return fallback;
}

/** Excel gives a Date for date cells and a string when the column was text. */
export function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = collapse(v);
  if (!s) return null;
  const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : toIsoDate(d);
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** «٤ اجزاء» · «جزئين» · «جزء» · «3» — the file uses all of these. */
export function ajzaFrom(v: unknown): number | null {
  const s = collapse(v);
  if (!s) return null;
  const n = num(s);
  if (n !== null && n > 0) return n;
  if (/جزئين|جزءان/.test(s)) return 2;
  if (/ثلاث/.test(s)) return 3;
  if (/أربع|اربع/.test(s)) return 4;
  if (/خمس/.test(s)) return 5;
  if (/ست/.test(s)) return 6;
  if (/سبع/.test(s)) return 7;
  if (/ثمان/.test(s)) return 8;
  if (/جزء/.test(s)) return 1;
  return null;
}

const COLS: Record<string, string[]> = {
  name:        ['اسم الطالب', 'أسم الطالب'],
  nationalId:  ['رقم الهوية', 'الهوية'],
  halaqa:      ['الحلقة', 'معلم الحلقة'],
  track:       ['المسار'],
  date:        ['التاريخ', 'تاريخ الإختبار', 'تاريخ الاختبار'],
  type:        ['نوع الاختبار', 'نوع الإختبار'],
  level:       ['المستوى'],
  ajza:        ['عدد الأجزاء', 'عدد الاجزاء'],
  errors:      ['عدد الاخطاء', 'عدد الأخطاء'],
  warnings:    ['عدد التنبيهات'],
  tajweed:     ['عدد الاخطاء التجويدية', 'عدد الأخطاء التجويدية'],
  score:       ['الدرجة النهائية', 'درجة الاختبار'],
  result:      ['النتيجة النهائية'],
  passed:      ['اجتاز'],
  note:        ['ملاحظة', 'ملاحظات المشرف', 'سبب عدم الإتمام'],
  examiner:    ['أسم المشرف', 'اسم المشرف'],
  pointsPaid:  ['نقاط تحفيز'],
};

const fold = (s: unknown) => foldArabic(s).toLowerCase();

function mapColumns(headers: string[]) {
  const idx: Record<string, number> = {};
  const take = (exact: boolean) => headers.forEach((h, i) => {
    const f = fold(h);
    if (!f) return;
    for (const [key, aliases] of Object.entries(COLS)) {
      if (idx[key] !== undefined) continue;
      if (aliases.some((a) => (exact ? f === fold(a) : f.includes(fold(a))))) idx[key] = i;
    }
  });
  take(true); take(false);
  return idx;
}

export type ExamRow = {
  rowNumber: number;
  exam: Omit<Exam, 'studentId'> & { studentId: string | null };
  rawName: string;
  rawId: string | null;
  matched: boolean;
};

export type ExamParse = {
  rows: ExamRow[];
  matched: number;
  unmatched: ExamRow[];
  skipped: number;
  columnMap: Record<string, number>;
  unmappedHeaders: string[];
};

export function parseExams(
  wb: XLSX.WorkBook,
  sheetName: string,
  students: Student[],
  headerRow: number,
  /* Qiyas exports only association exams. Its «نوع الإختبار» column holds the
     association's own categories — «تلقين», «أجزاء» — which describe what was
     examined, not a different kind of exam. Reading them as types turned 58
     association results into mock exams. */
  /* The tajweed log's «نوع الاختبار» is the RULE examined, so it becomes the
     topic rather than the type — every row in that sheet is a tajweed exam. */
  kind: 'QIYAS' | 'EXAMS' | 'TAJWEED' = 'EXAMS',
): ExamParse {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName],
    { header: 1, blankrows: false, defval: null });
  const headers = (grid[headerRow] || []).map((c) => collapse(c));
  const idx = mapColumns(headers);
  const cell = (r: unknown[], k: string) => (idx[k] === undefined ? null : r[idx[k]]);

  const byId = new Map<string, Student>();
  const byName = new Map<string, Student>();
  for (const s of students) {
    /* First match wins: the pool is ordered so that the id this batch commits
       comes before the one the store is about to replace. */
    if (s.nationalId && !byId.has(s.nationalId)) byId.set(s.nationalId, s);
    const n = foldArabic(s.fullName);
    if (!byName.has(n)) byName.set(n, s);
  }

  const rows: ExamRow[] = [];
  let skipped = 0;

  for (let i = headerRow + 1; i < grid.length; i++) {
    const r = grid[i] || [];
    const rawName = collapse(cell(r, 'name'));
    if (!rawName || ['المجموع', 'اسم الطالب'].includes(rawName)) { if (rawName) skipped++; continue; }

    const takenOn = toIsoDate(cell(r, 'date'));
    if (!takenOn) { skipped++; continue; }

    const { id: rawId } = normaliseNationalId(cell(r, 'nationalId'));
    const student = (rawId && byId.get(rawId)) || byName.get(foldArabic(rawName)) || null;

    const type: ExamType = kind === 'QIYAS' ? 'ASSOCIATION'
      : kind === 'TAJWEED' ? 'TAJWEED'
      : examTypeFrom(cell(r, 'type'));
    const topic = kind === 'TAJWEED' ? collapse(cell(r, 'type')) : '';
    const result = collapse(cell(r, 'result'));
    const passedCell = cell(r, 'passed');
    const score = num(cell(r, 'score'));
    const reason = collapse(cell(r, 'note'));

    /* «لم يحضر الطالب» — the sheet stores 0 for a student who never sat the
       exam. That is not a score of zero; recording it as one would drag his
       average down for an exam he did not take. */
    const absent = /لم\s*يحضر|لم\s*يحصل/.test(reason);

    const passed = passedCell !== null && passedCell !== undefined && passedCell !== ''
      ? passedCell === true || /^(true|نعم|اجتاز)$/i.test(collapse(passedCell))
      : result ? /ناجح|اجتاز/.test(result) && !/لم/.test(result)
      : null;

    rows.push({
      rowNumber: i + 1,
      rawName,
      rawId,
      matched: Boolean(student),
      exam: {
        id: uid(),
        studentId: student?.id ?? null,
        halaqaId: student?.halaqaId ?? null,
        track: student?.track ?? null,
        type,
        takenOn,
        /* A tajweed sitting is examined on a rule, not on a level. */
        level: kind === 'TAJWEED' ? null : num(cell(r, 'level')),
        ajza: kind === 'TAJWEED' ? null : ajzaFrom(cell(r, 'ajza')),
        errors: num(cell(r, 'errors')),
        warnings: num(cell(r, 'warnings')),
        tajweedErrors: num(cell(r, 'tajweed')),
        score: absent ? null : score,
        passed: absent ? false : passed,
        pointsAwarded: 0,
        pointsPaid: collapse(cell(r, 'pointsPaid')) === 'true',
        note: reason,
        examiner: collapse(cell(r, 'examiner')),
        tajweedTopics: topic ? [topic] : [],
        source: kind === 'QIYAS' ? 'QIYAS_IMPORT' : 'MANUAL',
        createdAt: new Date().toISOString(),
      },
    });
  }

  const unmatched = rows.filter((r) => !r.matched);
  return {
    rows,
    matched: rows.length - unmatched.length,
    unmatched,
    skipped,
    columnMap: idx,
    unmappedHeaders: headers.filter((h, i) => h && !Object.values(idx).includes(i)),
  };
}
