/* Ratel / roster → students + halaqat.  SPEC.md §5.1 · §5.3
   Contract: parse → classify → preview → commit. Nothing is written before the
   supervisor confirms, and an import NEVER deletes. */
import * as XLSX from 'xlsx';
import type { Student, Halaqa, Track } from '@/lib/types';
import { AR_TRACK } from '@/lib/types';
import {
  collapse, foldArabic, stripTeacherPrefix, normalisePhone,
  normaliseNationalId, isNonStudentRow,
} from '@/lib/normalise';
import { scanSheet, type SheetScan } from './detect';

/** Column aliases — matched on folded header text, position-independent. */
const COLS: Record<string, string[]> = {
  name:       ['اسم الطالب', 'أسم الطالب', 'اسم الطالب ثلاثي'],
  nationalId: ['رقم الهوية', 'الهوية'],
  track:      ['المسار'],
  halaqa:     ['الحلقة'],
  grade:      ['الصف'],
  stage:      ['المرحلة الدراسية'],
  nationality:['الجنسية'],
  phone:      ['جوال ولي الأمر'],
  mosque:     ['المسجد'],
  attended:   ['الحضور'],
  hifzPages:  ['الحفظ بالأوجه'],
  reviewPages:['المراجعة بالأوجه'],
  hifzTeacher:['معلم الحفظ'],
};

const fold = (s: unknown) => foldArabic(s).toLowerCase();

function mapColumns(headers: string[]) {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const f = fold(h);
    if (!f) return;
    for (const [key, aliases] of Object.entries(COLS)) {
      if (idx[key] !== undefined) continue;
      if (aliases.some((a) => f === fold(a))) idx[key] = i;
    }
  });
  // second pass: allow "contains" for headers with stray suffixes («الجنسية »)
  headers.forEach((h, i) => {
    const f = fold(h);
    if (!f) return;
    for (const [key, aliases] of Object.entries(COLS)) {
      if (idx[key] !== undefined) continue;
      if (aliases.some((a) => f.includes(fold(a)))) idx[key] = i;
    }
  });
  return idx;
}

export type RowIssue = 'NO_NAME' | 'NO_ID' | 'SHORT_ID' | 'LONG_ID' | 'DUP_ID' | 'NO_HALAQA' | 'SKIPPED';

export type ParsedRow = {
  rowNumber: number;
  student: Student;
  halaqaName: string;
  issues: RowIssue[];
};

export type ParseResult = {
  scan: SheetScan;
  rows: ParsedRow[];
  halaqat: Halaqa[];
  skipped: { rowNumber: number; reason: string; raw: string }[];
  unmappedHeaders: string[];
  columnMap: Record<string, number>;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function parseRoster(wb: XLSX.WorkBook, sheetName: string): ParseResult {
  const ws = wb.Sheets[sheetName];
  const scan = scanSheet(ws, sheetName);
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: null });
  const headerRow = scan.headerRow >= 0 ? scan.headerRow : 0;
  const headers = (grid[headerRow] || []).map((c) => collapse(c));
  const idx = mapColumns(headers);

  const unmappedHeaders = headers.filter((h, i) => h && !Object.values(idx).includes(i));

  const rows: ParsedRow[] = [];
  const skipped: ParseResult['skipped'] = [];
  const halaqaByName = new Map<string, Halaqa>();
  const seenIds = new Map<string, number>();

  const cell = (r: unknown[], key: string) => (idx[key] === undefined ? null : r[idx[key]]);

  for (let i = headerRow + 1; i < grid.length; i++) {
    const r = grid[i] || [];
    const rowNumber = i + 1;
    const rawName = collapse(cell(r, 'name'));

    if (isNonStudentRow(rawName)) {
      if (rawName) skipped.push({ rowNumber, reason: 'صف غير طالب (مجموع أو ترويسة مكررة)', raw: rawName });
      continue;
    }

    const { id: nationalId, flag } = normaliseNationalId(cell(r, 'nationalId'));
    const halaqaName = collapse(cell(r, 'halaqa'));
    const trackAr = collapse(cell(r, 'track'));
    const track: Track | null = AR_TRACK[trackAr] ?? null;

    let halaqaId: string | null = null;
    if (halaqaName) {
      let h = halaqaByName.get(halaqaName);
      if (!h) {
        const teacherFromCol = stripTeacherPrefix(cell(r, 'hifzTeacher'));
        h = {
          id: uid(),
          name: halaqaName,
          teacher: teacherFromCol || deriveTeacher(halaqaName),
          mosque: collapse(cell(r, 'mosque')) || 'جامع محمد العبدالكريم — حي أُحد',
          timeSlot: deriveTimeSlot(halaqaName),
        };
        halaqaByName.set(halaqaName, h);
      }
      halaqaId = h.id;
    }

    const issues: RowIssue[] = [];
    if (!nationalId) issues.push('NO_ID');
    if (flag === 'SHORT') issues.push('SHORT_ID');
    if (flag === 'LONG') issues.push('LONG_ID');
    if (!halaqaId) issues.push('NO_HALAQA');
    if (nationalId) {
      if (seenIds.has(nationalId)) issues.push('DUP_ID');
      else seenIds.set(nationalId, rowNumber);
    }

    const attendedRaw = cell(r, 'attended');
    const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };

    rows.push({
      rowNumber,
      halaqaName,
      issues,
      student: {
        id: uid(),
        fullName: rawName,
        nationalId,
        nationalIdFlag: issues.includes('DUP_ID') ? 'DUPLICATE' : flag,
        track,
        halaqaId,
        grade: collapse(cell(r, 'grade')),
        stage: collapse(cell(r, 'stage')),
        nationality: collapse(cell(r, 'nationality')),
        guardianPhone: normalisePhone(cell(r, 'phone')),
        status: 'ACTIVE',
        currentLevel: null,
        attended: attendedRaw === null ? undefined : Number(attendedRaw) === 1,
        hifzPages: num(cell(r, 'hifzPages')),
        reviewPages: num(cell(r, 'reviewPages')),
      },
    });
  }

  // A file may carry the same id on two different rows. Both are imported —
  // the supervisor decides whether they are brothers or a stale row.
  const keyUse = new Map<string, number>();
  for (const row of rows) {
    const base = row.student.nationalId || foldArabic(row.student.fullName);
    const n = (keyUse.get(base) ?? 0) + 1;
    keyUse.set(base, n);
    row.student.dedupeKey = n === 1 ? base : `${base}#${n}`;
  }

  // mark the FIRST occurrence of a duplicated id as duplicate too — both need review
  const dupIds = new Set(rows.filter((x) => x.issues.includes('DUP_ID')).map((x) => x.student.nationalId));
  for (const row of rows) {
    if (row.student.nationalId && dupIds.has(row.student.nationalId) && !row.issues.includes('DUP_ID')) {
      row.issues.push('DUP_ID');
      row.student.nationalIdFlag = 'DUPLICATE';
    }
  }

  return { scan, rows, halaqat: [...halaqaByName.values()], skipped, unmappedHeaders, columnMap: idx };
}

/** «تحفيظ حسن محمد ماهر علي (العصر)» → «حسن محمد ماهر علي» */
function deriveTeacher(halaqaName: string) {
  return collapse(halaqaName.replace(/^(تحفيظ|تلقين)\s+/, '').replace(/\(.*\)\s*$/, ''));
}
/** «… (العصر)» → «العصر» */
function deriveTimeSlot(halaqaName: string) {
  const m = halaqaName.match(/\(([^)]+)\)/);
  return m ? collapse(m[1]) : 'العصر';
}

export const ISSUE_AR: Record<RowIssue, string> = {
  NO_NAME: 'بلا اسم', NO_ID: 'بلا رقم هوية', SHORT_ID: 'رقم هوية قصير',
  LONG_ID: 'رقم هوية طويل', DUP_ID: 'رقم هوية مكرّر', NO_HALAQA: 'بلا حلقة',
  SKIPPED: 'صف متجاوَز',
};
