/* One file in, everything it carries out. The supervisor should not have to
   know that his workbook holds four different things, nor open four screens to
   get them in. He drops it once; this works out what is inside and where each
   part belongs. */
import * as XLSX from 'xlsx';
import type { Student, Halaqa, Exam, StudentPlan, CurriculumDay, Track } from '@/lib/types';
import { scanWorkbook, KIND_AR, type SheetScan, type FileKind } from './detect';
import { parseRoster, type ParseResult } from './roster';
import { parseExams, type ExamParse } from './exams';
import { parsePlanLog, toPlans, type PlanLogParse } from './planlog';
import { parseCurriculumSheet, CURRICULUM_SHEETS, type CurriculumParse } from './curriculum';

export type SheetOutcome =
  | { kind: 'ROSTER' | 'RATEL';  scan: SheetScan; roster: ParseResult }
  | { kind: 'QIYAS' | 'EXAMS';   scan: SheetScan; exams: ExamParse }
  | { kind: 'PLAN_LOG';          scan: SheetScan; planLog: PlanLogParse }
  | { kind: 'CURRICULUM';        scan: SheetScan; curriculum: CurriculumParse; track: Track }
  | { kind: 'UNSUPPORTED';       scan: SheetScan };

export type WorkbookRead = {
  fileName: string;
  sheets: SheetOutcome[];
  /** Everything ready to commit, already merged across the sheets. */
  payload: {
    students: Student[];
    halaqat: Halaqa[];
    exams: Exam[];
    plans: StudentPlan[];
    curriculum: { track: Exclude<Track, 'TALQEEN'>; days: CurriculumDay[] }[];
  };
  summary: {
    students: number; halaqat: number; exams: number; plans: number;
    curriculumLevels: number;
    /** Rows naming someone who is not in the roster — former students, mostly.
        Reported, never guessed at. */
    unmatched: number;
    flagged: number;
    skipped: number;
  };
};

/* Sheets are read in this order so that later ones can match against students
   the earlier ones established. A roster must exist before an exam log can be
   attached to anybody. */
const ORDER: FileKind[] = ['ROSTER', 'RATEL', 'CURRICULUM', 'PLAN_LOG', 'EXAMS', 'QIYAS', 'UNKNOWN'];

export function readWorkbook(
  wb: XLSX.WorkBook,
  fileName: string,
  knownStudents: Student[],
): WorkbookRead {
  const scans = [...scanWorkbook(wb)].sort(
    (a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  const out: SheetOutcome[] = [];
  const students: Student[] = [];
  const halaqat: Halaqa[] = [];
  const exams: Exam[] = [];
  const plans: StudentPlan[] = [];
  const curriculum: WorkbookRead['payload']['curriculum'] = [];
  let unmatched = 0, flagged = 0, skipped = 0;

  /* Grows as we go: a roster sheet read first lets the exam sheet after it
     find its students, even on the very first upload. */
  const pool = () => [...knownStudents, ...students];

  for (const scan of scans) {
    switch (scan.kind) {
      case 'ROSTER':
      case 'RATEL': {
        const r = parseRoster(wb, scan.sheet);
        out.push({ kind: scan.kind, scan, roster: r });
        for (const row of r.rows) {
          if (!students.some((s) => s.dedupeKey === row.student.dedupeKey)) students.push(row.student);
        }
        for (const h of r.halaqat) if (!halaqat.some((x) => x.name === h.name)) halaqat.push(h);
        flagged += r.rows.filter((x) => x.issues.length).length;
        skipped += r.skipped.length;
        break;
      }
      case 'QIYAS':
      case 'EXAMS': {
        const e = parseExams(wb, scan.sheet, pool(), scan.headerRow, scan.kind);
        out.push({ kind: scan.kind, scan, exams: e });
        for (const row of e.rows) {
          if (row.exam.studentId) exams.push(row.exam as Exam);
        }
        unmatched += e.unmatched.length;
        skipped += e.skipped;
        break;
      }
      case 'PLAN_LOG': {
        const p = parsePlanLog(wb, scan.sheet, pool(), scan.headerRow);
        out.push({ kind: scan.kind, scan, planLog: p });
        plans.push(...toPlans(p));
        unmatched += p.unmatched.length;
        skipped += p.skipped;
        break;
      }
      case 'CURRICULUM': {
        const track = CURRICULUM_SHEETS[scan.sheet];
        if (!track || track === 'TALQEEN') { out.push({ kind: 'UNSUPPORTED', scan }); break; }
        const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[scan.sheet],
          { header: 1, blankrows: false, defval: null });
        const c = parseCurriculumSheet(grid, scan.sheet, track);
        out.push({ kind: 'CURRICULUM', scan, curriculum: c, track });
        curriculum.push({ track, days: c.days });
        break;
      }
      default:
        out.push({ kind: 'UNSUPPORTED', scan });
    }
  }

  return {
    fileName,
    sheets: out,
    payload: { students, halaqat, exams, plans, curriculum },
    summary: {
      students: students.length,
      halaqat: halaqat.length,
      exams: exams.length,
      plans: plans.length,
      curriculumLevels: curriculum.reduce(
        (n, c) => n + new Set(c.days.map((d) => d.level)).size, 0),
      unmatched, flagged, skipped,
    },
  };
}

export { KIND_AR };
