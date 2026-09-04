/* «قاعدة بيانات متابعة خطة الحفظ» — when each student was handed which level.
   This is what «تأخّر في مستواه» measures from, so importing it is what makes
   that alert true on day one instead of after the first month of use. */
import * as XLSX from 'xlsx';
import type { Student, StudentPlan, Track } from '@/lib/types';
import { AR_TRACK } from '@/lib/types';
import { collapse, foldArabic } from '@/lib/normalise';
import { toIsoDate } from './exams';

const uid = () => Math.random().toString(36).slice(2, 10);

const COLS: Record<string, string[]> = {
  name:  ['اسم الطالب', 'أسم الطالب'],
  track: ['المسار'],
  level: ['المستوى'],
  date:  ['التاريخ'],
};

const fold = (s: unknown) => foldArabic(s).toLowerCase();

export type PlanLogRow = {
  rowNumber: number;
  rawName: string;
  studentId: string | null;
  track: Track | null;
  level: number;
  issuedAt: string;
  matched: boolean;
};

export type PlanLogParse = {
  rows: PlanLogRow[];
  matched: number;
  unmatched: PlanLogRow[];
  skipped: number;
  /** One student may appear many times — every level he has been handed. Only
      the latest becomes his current sheet; the rest are his history. */
  latestByStudent: Map<string, PlanLogRow>;
  columnMap: Record<string, number>;
};

export function parsePlanLog(
  wb: XLSX.WorkBook,
  sheetName: string,
  students: Student[],
  headerRow: number,
): PlanLogParse {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName],
    { header: 1, blankrows: false, defval: null });
  const headers = (grid[headerRow] || []).map((c) => collapse(c));

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

  const cell = (r: unknown[], k: string) => (idx[k] === undefined ? null : r[idx[k]]);
  /* First match wins — `new Map(...)` would let a later duplicate overwrite an
     earlier one, and the pool is ordered so the earlier id is the right one. */
  const byName = new Map<string, typeof students[number]>();
  for (const s of students) {
    const n = foldArabic(s.fullName);
    if (!byName.has(n)) byName.set(n, s);
  }

  const rows: PlanLogRow[] = [];
  let skipped = 0;

  for (let i = headerRow + 1; i < grid.length; i++) {
    const r = grid[i] || [];
    const rawName = collapse(cell(r, 'name'));
    const level = Number(collapse(cell(r, 'level')));
    const issuedAt = toIsoDate(cell(r, 'date'));

    if (!rawName || !Number.isFinite(level) || level <= 0 || !issuedAt) { skipped++; continue; }

    const student = byName.get(foldArabic(rawName)) ?? null;
    rows.push({
      rowNumber: i + 1,
      rawName,
      studentId: student?.id ?? null,
      track: AR_TRACK[collapse(cell(r, 'track'))] ?? student?.track ?? null,
      level,
      issuedAt,
      matched: Boolean(student),
    });
  }

  const latestByStudent = new Map<string, PlanLogRow>();
  for (const row of rows) {
    if (!row.studentId) continue;
    const prev = latestByStudent.get(row.studentId);
    if (!prev || row.issuedAt > prev.issuedAt) latestByStudent.set(row.studentId, row);
  }

  const unmatched = rows.filter((r) => !r.matched);
  return {
    rows,
    matched: rows.length - unmatched.length,
    unmatched,
    skipped,
    latestByStudent,
    columnMap: idx,
  };
}

/** Turn matched rows into plans. The newest per student keeps its date; the
    older ones are his trail, and each keeps the date it was actually issued. */
export function toPlans(parse: PlanLogParse): StudentPlan[] {
  const out: StudentPlan[] = [];
  for (const r of parse.rows) {
    if (!r.studentId || !r.track || r.track === 'TALQEEN') continue;
    out.push({
      id: uid(),
      studentId: r.studentId,
      track: r.track,
      level: r.level,
      issuedAt: new Date(r.issuedAt).toISOString(),
      issuedBy: 'استيراد',
      dayCount: 24,
      examDays: { BADGE_GOLDEN: 12, BADGE_DIAMOND: 24 },
      dailyAmount: r.track === 'GOLDEN' ? 'وجه' : 'نصف وجه',
      printedCount: 0,
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}
