/* One upload surface, five file shapes. The supervisor drops a file; we work out
   what it is from its own headers instead of asking him to classify it.
   SPEC.md §5. */
import * as XLSX from 'xlsx';
import { collapse } from '@/lib/normalise';

export type FileKind = 'RATEL' | 'QIYAS' | 'EXAMS' | 'PLAN_LOG' | 'CURRICULUM' | 'ROSTER' | 'UNKNOWN';

export const KIND_AR: Record<FileKind, string> = {
  RATEL: 'تقرير رتل', QIYAS: 'نتائج قياس', EXAMS: 'سجل الاختبارات',
  PLAN_LOG: 'سجل متابعة الخطط', CURRICULUM: 'منهج الحفظ',
  ROSTER: 'قاعدة بيانات الطلاب', UNKNOWN: 'غير معروف',
};

export const KIND_TARGET: Record<FileKind, string> = {
  RATEL: 'الطلاب · الحضور · أوجه الحفظ والمراجعة',
  QIYAS: 'سجل اختبارات الجمعية',
  EXAMS: 'سجل الأوسمة واختبارات التجويد',
  PLAN_LOG: 'تواريخ تسليم المستويات',
  CURRICULUM: 'المنهج المرجعي',
  ROSTER: 'الطلاب والحلقات',
  UNKNOWN: '—',
};

/** Signature headers per kind — order-independent, matched on folded text. */
const SIGNATURES: { kind: FileKind; need: string[]; exclude?: string[]; weight?: number }[] = [
  { kind: 'RATEL',      need: ['اسم الطالب', 'المطلوب حفظه', 'مؤشر الحفظ'], weight: 4 },
  { kind: 'QIYAS',      need: ['النتيجة النهائية', 'تاريخ الإختبار'], weight: 4 },
  /* «نوع الاختبار» is what separates an exam log from a plan log — both carry
     الطالب/المسار/المستوى/المعلم, so the plan log must explicitly NOT have it. */
  { kind: 'EXAMS',      need: ['نوع الاختبار', 'الدرجة النهائية'], weight: 4 },
  { kind: 'PLAN_LOG',   need: ['اسم الطالب', 'المسار', 'المستوى', 'معلم الحلقة'],
                        exclude: ['نوع الاختبار', 'الدرجة النهائية', 'عدد الاخطاء'], weight: 2 },
  { kind: 'CURRICULUM', need: ['المستوى', 'اليوم', 'المقرر', 'من سورة'], weight: 4 },
  { kind: 'ROSTER',     need: ['اسم الطالب', 'الحلقة', 'رقم الهوية', 'المسار'], weight: 3 },
];

export type SheetScan = {
  sheet: string; kind: FileKind; headerRow: number; headers: string[]; dataRows: number;
};

const norm = (s: unknown) => collapse(s).replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');

/** The Ratel export puts a banner on row 1 and the real header on row 2 — and
    other files differ. Never assume an offset: find the row that carries the
    signature headers. SPEC.md §5.1 */
/* The dashboard workbook holds lookup sheets — «البحث باسم الطالب»,
   «البحث بالحلقة» — that show ONE student or ONE halaqa through formulas.
   They carry the same headers as the real logs, so they classify perfectly and
   import complete nonsense: reading them added fifteen students who do not
   exist and five halaqat that were never taught. They are outputs, not
   records, and their names say so. */
/* No \b here: JavaScript's word boundary is defined over [A-Za-z0-9_], so it
   never matches beside an Arabic letter and the whole pattern silently failed. */
const LOOKUP_SHEET = /^\s*(ال)?بحث(\s|$)/;

export function scanSheet(ws: XLSX.WorkSheet, sheetName: string): SheetScan {
  if (LOOKUP_SHEET.test(sheetName)) {
    return { sheet: sheetName, kind: 'UNKNOWN', headerRow: -1, headers: [], dataRows: 0 };
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: null });
  let best: SheetScan = { sheet: sheetName, kind: 'UNKNOWN', headerRow: -1, headers: [], dataRows: 0 };
  let bestScore = 0;

  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const cells = (rows[r] || []).map(norm);
    if (cells.filter(Boolean).length < 3) continue;
    for (const sig of SIGNATURES) {
      const has = (h: string) => cells.some((c) => c === norm(h) || c.includes(norm(h)));
      const hit = sig.need.filter(has).length;
      if (hit < sig.need.length) continue;
      if (sig.exclude?.some(has)) continue;
      const score = hit * (sig.weight ?? 1);
      if (score > bestScore) {
        bestScore = score;
        best = { sheet: sheetName, kind: sig.kind, headerRow: r,
                 headers: (rows[r] || []).map((c) => collapse(c)), dataRows: Math.max(rows.length - r - 1, 0) };
      }
    }
  }
  return best;
}

export function scanWorkbook(wb: XLSX.WorkBook): SheetScan[] {
  return wb.SheetNames.map((n) => scanSheet(wb.Sheets[n], n)).filter((s) => s.kind !== 'UNKNOWN');
}
