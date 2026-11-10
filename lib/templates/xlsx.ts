/* Upload templates — a file the supervisor fills and hands back, built so the
   importer reads it without guessing.

   Every template is shaped by the parser that will read it: the same sheet
   names, the same header text, the same column order the importers in
   lib/importers already recognise. Nothing here teaches the importer a new
   format; it teaches the person filling it the existing one — with dropdowns
   where the system has a fixed vocabulary (surahs, tracks, exam types, the
   halaqat and students it already knows) and validation where a wrong value
   would otherwise surface only after upload.

   Built in the browser on demand, so the lists are today's lists. exceljs is
   imported lazily: it is large and only this button needs it. */
import type ExcelJSNS from 'exceljs';
import type { CurriculumDay, PlanKind } from '@/lib/types';
import { ALL_GRADES, STAGES } from '@/lib/types';
import { SURAHS } from '@/lib/surahs';
import { ASSOCIATION_NOTE } from '@/lib/importers/curriculum';

type Workbook = ExcelJSNS.Workbook;
type Worksheet = ExcelJSNS.Worksheet;

/* ── palette — DESIGN.md tokens, as ARGB ─────────────────────────────────── */
const C = {
  brand900: 'FF0A403C', brand800: 'FF0B5F59', brand700: 'FF0E8D83',
  brand200: 'FFCFE2DF', brand100: 'FFE4EEEB', brand50: 'FFEFF4F2',
  page: 'FFF4F5F1', paper: 'FFFAFBF8', white: 'FFFFFFFF',
  ink900: 'FF191E1C', ink700: 'FF39423F', ink600: 'FF525C58', ink500: 'FF6C7773',
  ink300: 'FFB4BDB8', ink200: 'FFD6DCD6', ink150: 'FFE3E7E1',
  warn100: 'FFF0EADC', warn200: 'FFE2D6BC', warn700: 'FF7F6531',
  assoc100: 'FFE7F2F8', assoc700: 'FF2E3070',
  risk100: 'FFF0E4E1', risk700: 'FF834B42',
  ok100: 'FFE3EAE4', ok700: 'FF3E6B54',
};
const FONT = 'Segoe UI';

const fill = (argb: string): ExcelJSNS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const font = (o: Partial<ExcelJSNS.Font> = {}): Partial<ExcelJSNS.Font> =>
  ({ name: FONT, size: 11, color: { argb: C.ink900 }, ...o });
const thin = (argb = C.ink200): Partial<ExcelJSNS.Border> => ({ style: 'thin', color: { argb } });
const RIGHT: Partial<ExcelJSNS.Alignment> = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl', wrapText: true };
const CENTER: Partial<ExcelJSNS.Alignment> = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };

const col = (n: number) => {
  let s = ''; n += 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

async function newBook(): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'حلقة';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

/** The banner every sheet opens with — two merged rows, then a legend row. */
function banner(ws: Worksheet, width: number, title: string, subtitle: string) {
  const last = col(width - 1);
  ws.mergeCells(`A1:${last}1`);
  ws.mergeCells(`A2:${last}2`);
  const t = ws.getCell('A1');
  t.value = title;
  t.font = font({ size: 20, bold: true, color: { argb: C.white } });
  t.fill = fill(C.brand900);
  t.alignment = { ...RIGHT, indent: 1 };
  ws.getRow(1).height = 44;
  const s = ws.getCell('A2');
  s.value = subtitle;
  s.font = font({ size: 11, color: { argb: C.brand100 } });
  s.fill = fill(C.brand800);
  s.alignment = { ...RIGHT, indent: 1 };
  ws.getRow(2).height = 26;
}

function headerRow(ws: Worksheet, rowNo: number, headers: string[], notes: (string | undefined)[] = []) {
  const row = ws.getRow(rowNo);
  headers.forEach((h, i) => {
    const c = row.getCell(i + 1);
    c.value = h;
    c.font = font({ bold: true, color: { argb: C.white }, size: 12 });
    c.fill = fill(C.brand700);
    c.alignment = CENTER;
    c.border = { bottom: { style: 'medium', color: { argb: C.brand900 } }, left: thin(C.brand800), right: thin(C.brand800) };
    if (notes[i]) c.note = { texts: [{ text: notes[i]! }] } as ExcelJSNS.Comment;
  });
  row.height = 30;
}

/** A hidden sheet holding every dropdown's values, each column a defined name. */
function listsSheet(wb: Workbook, lists: Record<string, string[] | number[]>) {
  const ws = wb.addWorksheet('القوائم', { state: 'hidden', views: [{ rightToLeft: true }] });
  Object.entries(lists).forEach(([name, values], i) => {
    const letter = col(i);
    ws.getCell(`${letter}1`).value = name;
    const vals = values.length ? values : [''];
    vals.forEach((v, j) => { ws.getCell(`${letter}${j + 2}`).value = v; });
    wb.definedNames.add(`'القوائم'!$${letter}$2:$${letter}$${vals.length + 1}`, name);
  });
  return ws;
}

type DV = ExcelJSNS.DataValidation;
/* Range-wide validation: one rule for a whole column, written once in the
   file. exceljs supports it at runtime but leaves it out of its types. */
const dvs = (ws: Worksheet) =>
  (ws as unknown as { dataValidations: { add(ref: string, v: DV): void } }).dataValidations;
const listDV = (formula: string, title: string, prompt: string, strict = true): DV => ({
  type: 'list', allowBlank: true, formulae: [formula],
  showInputMessage: true, promptTitle: title.slice(0, 32), prompt: prompt.slice(0, 250),
  showErrorMessage: true, errorStyle: strict ? 'stop' : 'warning',
  errorTitle: 'اختر من القائمة',
  error: strict ? 'هذه الخانة تقبل ما في القائمة المنسدلة فقط.'
    : 'هذه القيمة ليست في القائمة. اضغط «نعم» إن كانت صحيحة وجديدة.',
});

/** The cover sheet: what this file is, where it goes, and the rules. */
function readme(
  wb: Workbook, title: string, where: string, rules: string[],
  columns?: { name: string; required: boolean; about: string; example: string }[],
) {
  const ws = wb.addWorksheet('اقرأني', {
    views: [{ rightToLeft: true, showGridLines: false }],
    properties: { tabColor: { argb: C.brand900 } },
  });
  ws.columns = [{ width: 3 }, { width: 26 }, { width: 11 }, { width: 58 }, { width: 30 }];
  ws.mergeCells('B2:E2'); ws.mergeCells('B3:E3');
  const t = ws.getCell('B2');
  t.value = title;
  t.font = font({ size: 24, bold: true, color: { argb: C.white } });
  t.fill = fill(C.brand900);
  t.alignment = { ...RIGHT, indent: 1 };
  ws.getRow(2).height = 52;
  const w = ws.getCell('B3');
  w.value = `يُرفع من: ${where}`;
  w.font = font({ size: 12, color: { argb: C.brand100 } });
  w.fill = fill(C.brand800);
  w.alignment = { ...RIGHT, indent: 1 };
  ws.getRow(3).height = 28;

  let r = 5;
  const section = (label: string) => {
    ws.mergeCells(`B${r}:E${r}`);
    const c = ws.getCell(`B${r}`);
    c.value = label;
    c.font = font({ size: 14, bold: true, color: { argb: C.brand900 } });
    c.border = { bottom: { style: 'medium', color: { argb: C.brand700 } } };
    c.alignment = RIGHT;
    ws.getRow(r).height = 26;
    r += 1;
  };

  section('القواعد');
  rules.forEach((rule, i) => {
    ws.mergeCells(`C${r}:E${r}`);
    const n = ws.getCell(`B${r}`);
    n.value = i + 1;
    n.font = font({ bold: true, size: 13, color: { argb: C.brand700 } });
    n.alignment = { horizontal: 'left', vertical: 'top' };
    const c = ws.getCell(`C${r}`);
    c.value = rule;
    c.font = font({ size: 12, color: { argb: C.ink700 } });
    c.alignment = { ...RIGHT, vertical: 'top' };
    c.fill = fill(i % 2 ? C.white : C.paper);
    ws.getRow(r).height = Math.max(22, Math.ceil(rule.length / 80) * 20);
    r += 1;
  });

  if (columns?.length) {
    r += 1;
    section('الأعمدة');
    ['العمود', 'مطلوب', 'ما يُكتب فيه', 'مثال'].forEach((h, i) => {
      const c = ws.getRow(r).getCell(i + 2);
      c.value = h;
      c.font = font({ bold: true, color: { argb: C.white } });
      c.fill = fill(C.brand700);
      c.alignment = CENTER;
    });
    ws.getRow(r).height = 24;
    r += 1;
    columns.forEach((cdef, i) => {
      const row = ws.getRow(r);
      const vals = [cdef.name, cdef.required ? 'نعم' : 'اختياري', cdef.about, cdef.example];
      vals.forEach((v, j) => {
        const c = row.getCell(j + 2);
        c.value = v;
        c.font = font(j === 0 ? { bold: true } : j === 1 && cdef.required
          ? { bold: true, color: { argb: C.risk700 } } : { color: { argb: C.ink700 } });
        c.alignment = j === 1 ? CENTER : RIGHT;
        c.fill = fill(i % 2 ? C.white : C.paper);
        c.border = { bottom: thin(C.ink150) };
      });
      row.height = Math.max(22, Math.ceil(cdef.about.length / 60) * 18);
      r += 1;
    });
  }

  r += 1;
  ws.mergeCells(`B${r}:E${r}`);
  const f = ws.getCell(`B${r}`);
  f.value = `قالب من نظام حلقة · أُنشئ ${new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-arab')}`;
  f.font = font({ size: 10, italic: true, color: { argb: C.ink500 } });
  f.alignment = RIGHT;
  return ws;
}

/* ═════════════════════════════════════════════════════════════════════════
   منهج الحفظ
   ═════════════════════════════════════════════════════════════════════════ */

/** The two exam days of every level, and what the file writes on them. */
export const EXAM_DAYS: Record<number, { label: string; tone: 'gold' | 'diamond' }> = {
  12: { label: 'الوسام الذهبي', tone: 'gold' },
  24: { label: 'الوسام الماسي', tone: 'diamond' },
};
const KINDS: { kind: PlanKind; ar: string }[] = [
  { kind: 'MURAJAA_KUBRA', ar: 'م.ك' },
  { kind: 'MURAJAA_SUGHRA', ar: 'م.ص' },
  { kind: 'DARS', ar: 'درس' },
];
/** The levels each track carries today — the screen shows the same ranges. */
export const DEFAULT_LEVELS: Record<'SILVER' | 'GOLDEN', number[]> = {
  SILVER: Array.from({ length: 26 }, (_, i) => 60 - i),   // 60 → 35
  GOLDEN: Array.from({ length: 30 }, (_, i) => 30 - i),   // 30 → 1
};
const TRACK_SHEET: Record<'SILVER' | 'GOLDEN', string> = { SILVER: 'فضي', GOLDEN: 'ذهبي' };

const asCell = (v: string) => (/^\d+$/.test(v) ? Number(v) : v || null);

function curriculumSheet(wb: Workbook, track: 'SILVER' | 'GOLDEN', current: CurriculumDay[]) {
  const name = TRACK_SHEET[track];
  const mine = current.filter((d) => d.track === track);
  const levels = [...new Set([...DEFAULT_LEVELS[track], ...mine.map((d) => d.level)])].sort((a, b) => b - a);
  const byKey = new Map(mine.map((d) => [`${d.level}|${d.dayNo}|${d.kind}`, d]));

  const ws = wb.addWorksheet(name, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 4, xSplit: 3, showGridLines: false }],
    properties: { tabColor: { argb: track === 'GOLDEN' ? 'FFB08D45' : 'FF8D9894' } },
  });
  ws.columns = [
    { width: 9 }, { width: 7 }, { width: 8 }, { width: 18 }, { width: 8 }, { width: 18 }, { width: 8 }, { width: 18 },
  ];
  banner(ws, 8, `منهج الحفظ · المسار ${name}`,
    `المستويات ${levels[0]} ← ${levels[levels.length - 1]} · ٢٤ يومًا لكل مستوى · كل يوم ثلاثة أسطر: م.ك ثم م.ص ثم درس`);

  /* row 3 — the legend, in the colours the rows below use */
  ws.mergeCells('A3:C3'); ws.mergeCells('D3:E3'); ws.mergeCells('F3:H3');
  const legend: [string, string, string, string][] = [
    ['A3', 'الخانات البيضاء لك', C.white, C.ink700],
    ['D3', 'يوم ١٢ · الوسام الذهبي', C.warn100, C.warn700],
    ['F3', 'يوم ٢٤ · الوسام الماسي', C.assoc100, C.assoc700],
  ];
  for (const [ref, text, bg, fg] of legend) {
    const c = ws.getCell(ref);
    c.value = text; c.fill = fill(bg); c.font = font({ bold: true, size: 10, color: { argb: fg } });
    c.alignment = CENTER; c.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };
  }
  ws.getRow(3).height = 22;

  headerRow(ws, 4, ['المستوى', 'اليوم', 'المقرر', 'من سورة', 'آية', 'الى سورة', 'آية', 'ملاحظة'], [
    undefined, undefined, 'م.ك: المراجعة الكبرى · م.ص: المراجعة الصغرى · درس: الحفظ الجديد',
    'اختر من القائمة', 'رقم الآية، أو «آخر»', 'اختر من القائمة', 'رقم الآية، أو «آخر»',
    'في اليوم ٢٤: اختر «اختبار الجمعية» للمستويات التي تختبرها الجمعية',
  ]);

  let r = 5;
  levels.forEach((level, li) => {
    const band = li % 2 ? C.brand100 : C.brand50;
    for (let day = 1; day <= 24; day++) {
      const exam = EXAM_DAYS[day];
      KINDS.forEach(({ kind, ar }, ki) => {
        const row = ws.getRow(r);
        const d = byKey.get(`${level}|${day}|${kind}`);
        row.getCell(1).value = level;
        row.getCell(2).value = day;
        row.getCell(3).value = ar;
        if (exam) {
          if (ki === 0) {
            row.getCell(4).value = exam.label;
            row.getCell(6).value = 'التاريخ';
            if (day === 24 && d?.note === ASSOCIATION_NOTE) row.getCell(8).value = ASSOCIATION_NOTE;
          }
        } else if (d) {
          row.getCell(4).value = asCell(d.fromSurah);
          row.getCell(5).value = asCell(d.fromAyah);
          row.getCell(6).value = asCell(d.toSurah);
          row.getCell(7).value = asCell(d.toAyah);
          row.getCell(8).value = d.note || null;
        }

        for (let c = 1; c <= 8; c++) {
          const cell = row.getCell(c);
          const fixed = c <= 3;
          const bg = fixed ? band
            : exam ? (exam.tone === 'gold' ? C.warn100 : C.assoc100) : C.white;
          cell.fill = fill(bg);
          cell.alignment = c === 8 ? RIGHT : CENTER;
          cell.font = font(fixed
            ? { color: { argb: c === 1 ? C.brand900 : C.ink600 }, bold: c === 1, size: c === 1 ? 12 : 11 }
            : exam ? { bold: ki === 0, color: { argb: exam.tone === 'gold' ? C.warn700 : C.assoc700 } }
            : {});
          cell.border = {
            top: ki === 0 ? (day === 1 ? { style: 'medium', color: { argb: C.brand800 } } : thin(C.ink300)) : thin(C.ink150),
            left: thin(C.ink150), right: thin(C.ink150),
          };
        }
        r += 1;
      });
    }
  });
  const last = r - 1;

  /* «آخر» or a whole number no larger than that surah's ayah count. */
  const ayahRule = (ayah: string, surah: string): DV => ({
    type: 'custom', allowBlank: true,
    formulae: [`OR(${ayah}5="آخر",AND(ISNUMBER(${ayah}5),${ayah}5>=1,INT(${ayah}5)=${ayah}5,${ayah}5<=IFERROR(INDEX(L_AYAHS,MATCH(${surah}5,L_SURAH,0)),286)))`],
    showInputMessage: true, promptTitle: 'رقم الآية', prompt: 'رقم الآية، أو «آخر» إن كان المقرر إلى آخر السورة.',
    showErrorMessage: true, errorStyle: 'stop', errorTitle: 'آية غير صحيحة',
    error: 'اكتب رقمًا لا يتجاوز عدد آيات السورة، أو «آخر».',
  });
  dvs(ws).add(`D5:D${last}`, listDV('L_SURAH', 'من سورة', 'اختر السورة من القائمة.'));
  dvs(ws).add(`F5:F${last}`, listDV('L_SURAH', 'إلى سورة', 'اختر السورة من القائمة.'));
  dvs(ws).add(`E5:E${last}`, ayahRule('E', 'D'));
  dvs(ws).add(`G5:G${last}`, ayahRule('G', 'F'));
  dvs(ws).add(`C5:C${last}`, listDV('"م.ك,م.ص,درس"', 'المقرر', 'لا تغيّره — مكتوب لك.'));
  dvs(ws).add(`B5:B${last}`, {
    type: 'whole', operator: 'between', allowBlank: false, formulae: [1, 24],
    showErrorMessage: true, errorTitle: 'اليوم', error: 'اليوم من ١ إلى ٢٤.',
  });

  /* Red where a line is half-written: a surah with no ayah, a start with no end. */
  const missing = fill(C.risk100);
  ws.addConditionalFormatting({
    ref: `E5:E${last}`,
    rules: [{ type: 'expression', priority: 1, formulae: ['AND($D5<>"",$E5="",ISERROR(SEARCH("الوسام",$D5)))'],
      style: { fill: { ...missing, bgColor: { argb: C.risk100 } } as ExcelJSNS.Fill } }],
  });
  ws.addConditionalFormatting({
    ref: `G5:G${last}`,
    rules: [{ type: 'expression', priority: 2, formulae: ['AND($F5<>"",$G5="",$F5<>"التاريخ")'],
      style: { fill: { ...missing, bgColor: { argb: C.risk100 } } as ExcelJSNS.Fill } }],
  });
  ws.addConditionalFormatting({
    ref: `F5:F${last}`,
    rules: [{ type: 'expression', priority: 3, formulae: ['AND($D5<>"",$F5="")'],
      style: { fill: { ...missing, bgColor: { argb: C.risk100 } } as ExcelJSNS.Fill } }],
  });

  ws.autoFilter = { from: 'A4', to: `H${last}` };
  return { name, levels, last };
}

/** A sheet that counts what has been filled per level — and says which levels
    the upload will skip because nothing in them is written yet. */
function progressSheet(wb: Workbook, tracks: { name: string; levels: number[]; last: number }[]) {
  const ws = wb.addWorksheet('متابعة التعبئة', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 4, showGridLines: false }],
    properties: { tabColor: { argb: C.brand700 } },
  });
  ws.columns = [{ width: 12 }, { width: 10 }, { width: 16 }, { width: 26 }];
  banner(ws, 4, 'متابعة التعبئة', 'يتحدّث وحده وأنت تعبّئ');
  headerRow(ws, 4, ['المسار', 'المستوى', 'أسطر معبّأة', 'عند الرفع']);
  let r = 5;
  for (const t of tracks) {
    for (const level of t.levels) {
      const row = ws.getRow(r);
      row.getCell(1).value = t.name;
      row.getCell(2).value = level;
      const rng = (c: string) => `'${t.name}'!$${c}$5:$${c}$${t.last}`;
      row.getCell(3).value = {
        formula: `COUNTIFS(${rng('A')},B${r},${rng('D')},"?*",${rng('D')},"<>الوسام*",${rng('D')},"<>-")`,
      } as ExcelJSNS.CellFormulaValue;
      row.getCell(4).value = { formula: `IF(C${r}=0,"فارغ — يبقى كما هو في النظام","يُرفع ويستبدل هذا المستوى")` } as ExcelJSNS.CellFormulaValue;
      for (let c = 1; c <= 4; c++) {
        const cell = row.getCell(c);
        cell.alignment = c === 4 ? RIGHT : CENTER;
        cell.font = font(c === 2 ? { bold: true, color: { argb: C.brand900 } } : { color: { argb: C.ink700 } });
        cell.border = { bottom: thin(C.ink150) };
      }
      r += 1;
    }
  }
  ws.addConditionalFormatting({
    ref: `C5:C${r - 1}`,
    rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, gradient: true,
      cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 66 }],
      color: { argb: C.brand700 } } as unknown as ExcelJSNS.ConditionalFormattingRule],
  });
  ws.addConditionalFormatting({
    ref: `D5:D${r - 1}`,
    rules: [{ type: 'expression', priority: 2, formulae: [`$C5=0`],
      style: { font: { color: { argb: C.ink500 } } } },
    { type: 'expression', priority: 3, formulae: [`$C5>0`],
      style: { font: { color: { argb: C.ok700 }, bold: true } } }],
  });
}

/**
 * «منهج الحفظ» — both tracks, every level pre-laid as 24 days × 3 lines, the
 * exam days already marked. Pass the loaded curriculum to get today's
 * content back in the same template, ready to correct.
 */
export async function buildCurriculumTemplate(current: CurriculumDay[] = []) {
  const wb = await newBook();
  const prefilled = current.some((d) => d.fromSurah || d.toSurah);
  readme(wb, prefilled ? 'منهج الحفظ — النسخة الحالية' : 'قالب منهج الحفظ',
    'الخطط ← منهج الحفظ ← رفع الملف (أو صفحة «رفع الملفات»)', [
      'لا تغيّر اسم الورقتين «فضي» و«ذهبي»، ولا عناوين الأعمدة ولا ترتيبها.',
      'المستوى واليوم والمقرر مكتوبة لك. لا تحذف صفًا ولا تُضف صفًا.',
      'كل يوم ثلاثة أسطر بهذا الترتيب: م.ك (المراجعة الكبرى) ثم م.ص (المراجعة الصغرى) ثم درس (الحفظ الجديد).',
      'اليوم ١٢ اختبار الوسام الذهبي، واليوم ٢٤ اختبار الوسام الماسي. صفوفهما ملوّنة ولا يُكتب فيها مقرر.',
      'اختر «من سورة» و«الى سورة» من القائمة المنسدلة. فيها السور الـ١١٤ بأسمائها في المصحف.',
      'الآية رقم، أو «آخر» إن كان المقرر إلى آخر السورة. لا يقبل الملف آية أكبر من عدد آيات السورة.',
      'المستوى الذي تختبره الجمعية: اختر «اختبار الجمعية» في خانة «ملاحظة» لليوم ٢٤.',
      'الخانة الحمراء تعني أن السطر ناقص: سورة بلا آية، أو بداية بلا نهاية.',
      'المستوى الذي تتركه فارغًا كله لا يُرفع، ويبقى في النظام كما هو. فتقدر تعبّئ مستوى واحدًا وترفعه وحده.',
      'ورقة «متابعة التعبئة» تعدّ لك ما عبّأته في كل مستوى.',
      'بعد الرفع يعرض النظام معاينة، ولا يُحفظ شيء قبل أن تضغط «اعتماد المنهج».',
    ]);
  const silver = curriculumSheet(wb, 'SILVER', current);
  const golden = curriculumSheet(wb, 'GOLDEN', current);
  progressSheet(wb, [silver, golden]);
  listsSheet(wb, {
    L_SURAH: SURAHS.map((s) => s.name),
    L_AYAHS: SURAHS.map((s) => s.ayahs),
  });
  return finish(wb, prefilled ? 'منهج-الحفظ-الحالي.xlsx' : 'قالب-منهج-الحفظ.xlsx');
}

/* ═════════════════════════════════════════════════════════════════════════
   The flat logs — one header row, one record per row
   ═════════════════════════════════════════════════════════════════════════ */

export type TemplateLists = {
  students: string[];
  halaqat: string[];
  tajweedTopics: string[];
};

type ColumnKind =
  | { t: 'text' }
  | { t: 'list'; name: string; strict?: boolean }
  | { t: 'int'; min: number; max: number }
  | { t: 'date' }
  | { t: 'id' }
  | { t: 'phone' };

type ColumnSpec = {
  header: string; width: number; required: boolean;
  about: string; example: string; kind: ColumnKind;
};

export type TableKind = 'ROSTER' | 'EXAMS' | 'TAJWEED' | 'PLAN_LOG';

const TRACKS_AR = ['فضي', 'ذهبي', 'تلقين'];
const EXAM_TYPES = ['الوسام الذهبي', 'الوسام الماسي', 'اختبار الجمعية', 'اختبار تجريبي'];
const LEVELS = Array.from({ length: 60 }, (_, i) => i + 1);

/* Headers are the importers' own aliases (lib/importers) — change one there
   and the template must follow, or the upload stops recognising it. */
const TABLES: Record<TableKind, {
  sheet: string; file: string; title: string; where: string; tab: string;
  rules: string[]; columns: ColumnSpec[];
}> = {
  ROSTER: {
    sheet: 'الطلاب', file: 'قالب-الطلاب.xlsx', title: 'قالب الطلاب والحلقات', tab: C.brand700,
    where: 'الصفحة الرئيسية ← رفع الملفات',
    rules: [
      'طالب واحد في كل صف، ابتداءً من الصف الأول تحت العناوين.',
      'لا تغيّر عناوين الأعمدة. ترتيبها لا يهم، والعمود الاختياري تقدر تتركه فارغًا.',
      'رقم الهوية عشرة أرقام. هو ما يميّز الطالب، فالطالب الموجود يُحدَّث ولا يتكرّر.',
      'الحلقة: اختر من القائمة. إن كتبت حلقة جديدة يسألك الملف، وتُنشأ عند الرفع.',
      'الرفع لا يحذف أحدًا. الطالب الذي لا يرد في الملف يبقى كما هو.',
      'بعد الرفع يعرض النظام معاينة، ولا يُحفظ شيء قبل أن تضغط «اعتماد».',
    ],
    columns: [
      { header: 'اسم الطالب', width: 32, required: true, about: 'الاسم رباعيًا كما في الهوية.', example: 'أحمد محمد صالح الحصن', kind: { t: 'text' } },
      { header: 'رقم الهوية', width: 15, required: true, about: 'عشرة أرقام.', example: '1234567890', kind: { t: 'id' } },
      { header: 'المسار', width: 10, required: true, about: 'فضي أو ذهبي أو تلقين.', example: 'فضي', kind: { t: 'list', name: 'L_TRACK', strict: true } },
      { header: 'الحلقة', width: 40, required: true, about: 'اسم الحلقة كما في النظام.', example: 'تحفيظ حسن محمد ماهر علي (العصر)', kind: { t: 'list', name: 'L_HALAQA', strict: false } },
      { header: 'الصف', width: 14, required: false, about: 'الصف الدراسي.', example: 'أول متوسط', kind: { t: 'list', name: 'L_GRADE', strict: false } },
      { header: 'المرحلة الدراسية', width: 14, required: false, about: 'تلقين، ابتدائي، متوسط، ثانوي.', example: 'متوسط', kind: { t: 'list', name: 'L_STAGE', strict: true } },
      { header: 'الجنسية', width: 12, required: false, about: 'سعودي أو غير سعودي.', example: 'سعودي', kind: { t: 'list', name: 'L_NATION', strict: false } },
      { header: 'جوال ولي الأمر', width: 15, required: false, about: 'يبدأ بـ05، عشرة أرقام.', example: '0551234567', kind: { t: 'phone' } },
    ],
  },
  EXAMS: {
    sheet: 'الاختبارات', file: 'قالب-الاختبارات.xlsx', title: 'قالب سجل الاختبارات', tab: 'FFB08D45',
    where: 'الصفحة الرئيسية ← رفع الملفات',
    rules: [
      'اختبار واحد في كل صف. الطالب الذي اختبر مرتين له صفّان.',
      'اختر اسم الطالب من القائمة؛ فيها طلاب النظام الآن. الاسم الذي لا يطابق طالبًا يُعرض لك ولا يُرفع.',
      'رقم الهوية اختياري، لكنه يضمن المطابقة إن تشابهت الأسماء.',
      'التاريخ إلزامي. الصف الذي بلا تاريخ يُتجاوَز.',
      'نوع الاختبار من القائمة: الوسام الذهبي، الوسام الماسي، اختبار الجمعية، اختبار تجريبي.',
      'الطالب الذي لم يحضر: اكتب «لم يحضر» في الملاحظة، فلا تُحسب عليه درجة.',
      'بعد الرفع يعرض النظام معاينة، ولا يُحفظ شيء قبل أن تضغط «اعتماد».',
    ],
    columns: [
      { header: 'اسم الطالب', width: 32, required: true, about: 'اختر من القائمة.', example: 'أحمد محمد صالح الحصن', kind: { t: 'list', name: 'L_STUDENT', strict: false } },
      { header: 'رقم الهوية', width: 15, required: false, about: 'عشرة أرقام.', example: '1234567890', kind: { t: 'id' } },
      { header: 'المسار', width: 10, required: false, about: 'فضي أو ذهبي أو تلقين.', example: 'فضي', kind: { t: 'list', name: 'L_TRACK', strict: true } },
      { header: 'معلم الحلقة', width: 40, required: false, about: 'الحلقة.', example: 'تحفيظ حسن محمد ماهر علي (العصر)', kind: { t: 'list', name: 'L_HALAQA', strict: false } },
      { header: 'التاريخ', width: 14, required: true, about: 'تاريخ الاختبار بالميلادي.', example: '2026/11/10', kind: { t: 'date' } },
      { header: 'نوع الاختبار', width: 16, required: true, about: 'من القائمة.', example: 'الوسام الذهبي', kind: { t: 'list', name: 'L_EXAM', strict: true } },
      { header: 'المستوى', width: 10, required: false, about: 'من ١ إلى ٦٠.', example: '45', kind: { t: 'int', min: 1, max: 60 } },
      { header: 'عدد الاخطاء', width: 11, required: false, about: 'رقم.', example: '2', kind: { t: 'int', min: 0, max: 999 } },
      { header: 'عدد التنبيهات', width: 12, required: false, about: 'رقم.', example: '3', kind: { t: 'int', min: 0, max: 999 } },
      { header: 'عدد الاخطاء التجويدية', width: 16, required: false, about: 'رقم.', example: '1', kind: { t: 'int', min: 0, max: 999 } },
      { header: 'الدرجة النهائية', width: 13, required: true, about: 'من ٠ إلى ١٠٠.', example: '95', kind: { t: 'int', min: 0, max: 100 } },
      { header: 'عدد الاجزاء', width: 11, required: false, about: 'لاختبار الجمعية: كم جزءًا.', example: '4', kind: { t: 'int', min: 1, max: 30 } },
      { header: 'ملاحظة', width: 26, required: false, about: 'أي ملاحظة، أو «لم يحضر».', example: '', kind: { t: 'text' } },
      { header: 'اجتاز', width: 9, required: false, about: 'نعم أو لا. إن تركته يُحسب من الدرجة.', example: 'نعم', kind: { t: 'list', name: 'L_YESNO', strict: true } },
    ],
  },
  TAJWEED: {
    sheet: 'اختبارات التجويد', file: 'قالب-اختبارات-التجويد.xlsx', title: 'قالب اختبارات التجويد', tab: C.assoc700,
    where: 'الصفحة الرئيسية ← رفع الملفات',
    rules: [
      'اختبار واحد في كل صف.',
      'اختر اسم الطالب من القائمة. الاسم الذي لا يطابق طالبًا يُعرض لك ولا يُرفع.',
      'نوع الاختبار هنا هو الحكم التجويدي الذي اختُبر فيه، من القائمة.',
      'الدرجة من ١٠.',
      'التاريخ إلزامي. الصف الذي بلا تاريخ يُتجاوَز.',
      'بعد الرفع يعرض النظام معاينة، ولا يُحفظ شيء قبل أن تضغط «اعتماد».',
    ],
    columns: [
      { header: 'اسم الطالب', width: 32, required: true, about: 'اختر من القائمة.', example: 'أحمد محمد صالح الحصن', kind: { t: 'list', name: 'L_STUDENT', strict: false } },
      { header: 'رقم الهوية', width: 15, required: false, about: 'عشرة أرقام.', example: '1234567890', kind: { t: 'id' } },
      { header: 'المسار', width: 10, required: false, about: 'فضي أو ذهبي أو تلقين.', example: 'فضي', kind: { t: 'list', name: 'L_TRACK', strict: true } },
      { header: 'معلم الحلقة', width: 40, required: false, about: 'الحلقة.', example: 'تحفيظ حسن محمد ماهر علي (العصر)', kind: { t: 'list', name: 'L_HALAQA', strict: false } },
      { header: 'التاريخ', width: 14, required: true, about: 'تاريخ الاختبار بالميلادي.', example: '2026/11/10', kind: { t: 'date' } },
      { header: 'نوع الاختبار', width: 26, required: true, about: 'الحكم التجويدي.', example: 'النون الساكنة والتنوين', kind: { t: 'list', name: 'L_TOPIC', strict: false } },
      { header: 'درجة الاختبار', width: 13, required: true, about: 'من ٠ إلى ١٠.', example: '9', kind: { t: 'int', min: 0, max: 10 } },
      { header: 'ملاحظة', width: 26, required: false, about: 'أي ملاحظة، أو «لم يحضر».', example: '', kind: { t: 'text' } },
    ],
  },
  PLAN_LOG: {
    sheet: 'متابعة الخطط', file: 'قالب-متابعة-الخطط.xlsx', title: 'قالب متابعة الخطط', tab: C.ok700,
    where: 'الصفحة الرئيسية ← رفع الملفات',
    rules: [
      'صف لكل مستوى سُلِّم لطالب: متى استلمه وأي مستوى.',
      'الطالب الذي استلم عدة مستويات له عدة صفوف. أحدثها تاريخًا هو مستواه الحالي.',
      'اختر اسم الطالب من القائمة. الاسم الذي لا يطابق طالبًا يُعرض لك ولا يُرفع.',
      'المستوى من القائمة، والتاريخ تاريخ الاستلام بالميلادي.',
      'بعد الرفع يعرض النظام معاينة، ولا يُحفظ شيء قبل أن تضغط «اعتماد».',
    ],
    columns: [
      { header: 'اسم الطالب', width: 32, required: true, about: 'اختر من القائمة.', example: 'أحمد محمد صالح الحصن', kind: { t: 'list', name: 'L_STUDENT', strict: false } },
      { header: 'المسار', width: 10, required: true, about: 'فضي أو ذهبي.', example: 'فضي', kind: { t: 'list', name: 'L_TRACK', strict: true } },
      { header: 'المستوى', width: 10, required: true, about: 'من ١ إلى ٦٠.', example: '45', kind: { t: 'list', name: 'L_LEVEL', strict: true } },
      { header: 'معلم الحلقة', width: 40, required: false, about: 'الحلقة.', example: 'تحفيظ حسن محمد ماهر علي (العصر)', kind: { t: 'list', name: 'L_HALAQA', strict: false } },
      { header: 'التاريخ', width: 14, required: true, about: 'تاريخ استلام المستوى.', example: '2026/11/10', kind: { t: 'date' } },
    ],
  },
};

export const TABLE_TEMPLATES = Object.fromEntries(
  Object.entries(TABLES).map(([k, v]) => [k, { title: v.title, file: v.file }])) as
  Record<TableKind, { title: string; file: string }>;

/** How many rows are dressed and validated — far more than any one upload. */
const ROWS = 500;

export async function buildTableTemplate(kind: TableKind, lists: TemplateLists) {
  const spec = TABLES[kind];
  const wb = await newBook();
  readme(wb, spec.title, spec.where, spec.rules,
    spec.columns.map((c) => ({ name: c.header, required: c.required, about: c.about, example: c.example })));

  const ws = wb.addWorksheet(spec.sheet, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }],
    properties: { tabColor: { argb: spec.tab } },
  });
  const n = spec.columns.length;
  ws.columns = spec.columns.map((c) => ({ width: c.width }));
  banner(ws, n, spec.title, 'عبّئ من الصف الخامس نزولًا · الأعمدة المعلّمة بـ ● إلزامية · القواعد في ورقة «اقرأني»');

  /* row 3 — which columns must be filled, above each header */
  spec.columns.forEach((c, i) => {
    const cell = ws.getRow(3).getCell(i + 1);
    cell.value = c.required ? '● إلزامي' : 'اختياري';
    cell.font = font({ size: 9, bold: c.required, color: { argb: c.required ? C.risk700 : C.ink500 } });
    cell.fill = fill(c.required ? C.risk100 : C.page);
    cell.alignment = CENTER;
  });
  ws.getRow(3).height = 18;
  headerRow(ws, 4, spec.columns.map((c) => c.header), spec.columns.map((c) => c.about));

  const last = 4 + ROWS;
  for (let r = 5; r <= last; r++) {
    const row = ws.getRow(r);
    spec.columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.fill = fill(r % 2 ? C.white : C.paper);
      cell.border = { bottom: thin(C.ink150), left: thin(C.ink150) };
      cell.font = font();
      cell.alignment = c.kind.t === 'text' || (c.kind.t === 'list' && c.width > 20) ? RIGHT : CENTER;
      if (c.kind.t === 'id' || c.kind.t === 'phone') cell.numFmt = '@';
      if (c.kind.t === 'date') cell.numFmt = 'yyyy/mm/dd';
    });
  }

  spec.columns.forEach((c, i) => {
    const L = col(i);
    const ref = `${L}5:${L}${last}`;
    const k = c.kind;
    if (k.t === 'list') dvs(ws).add(ref, listDV(k.name, c.header, c.about, k.strict ?? true));
    else if (k.t === 'int') dvs(ws).add(ref, {
      type: 'whole', operator: 'between', allowBlank: true, formulae: [k.min, k.max],
      showInputMessage: true, promptTitle: c.header.slice(0, 32), prompt: c.about,
      showErrorMessage: true, errorStyle: 'stop', errorTitle: c.header.slice(0, 32),
      error: `رقم صحيح من ${k.min} إلى ${k.max}.`,
    });
    else if (k.t === 'date') dvs(ws).add(ref, {
      type: 'date', operator: 'between', allowBlank: true,
      formulae: [new Date(2015, 0, 1), new Date(2040, 11, 31)],
      showInputMessage: true, promptTitle: 'التاريخ', prompt: 'بالميلادي، مثل 2026/11/10',
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'تاريخ غير صحيح',
      error: 'اكتب التاريخ بالميلادي، مثل 2026/11/10',
    });
    else if (k.t === 'id') dvs(ws).add(ref, {
      type: 'custom', allowBlank: true, formulae: [`AND(LEN(${L}5)=10,ISNUMBER(--${L}5))`],
      showInputMessage: true, promptTitle: 'رقم الهوية', prompt: 'عشرة أرقام.',
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'رقم هوية غير صحيح',
      error: 'رقم الهوية عشرة أرقام بلا مسافات.',
    });
    else if (k.t === 'phone') dvs(ws).add(ref, {
      type: 'custom', allowBlank: true, formulae: [`AND(LEN(${L}5)=10,LEFT(${L}5,2)="05",ISNUMBER(--${L}5))`],
      showInputMessage: true, promptTitle: 'الجوال', prompt: 'يبدأ بـ05، عشرة أرقام.',
      showErrorMessage: true, errorStyle: 'warning', errorTitle: 'رقم جوال غير معتاد',
      error: 'الجوال السعودي عشرة أرقام يبدأ بـ05.',
    });
  });

  /* A row that has begun but misses a required field turns that cell red. */
  const anyFilled = `COUNTA($A5:$${col(n - 1)}5)>0`;
  spec.columns.forEach((c, i) => {
    if (!c.required) return;
    const L = col(i);
    ws.addConditionalFormatting({
      ref: `${L}5:${L}${last}`,
      rules: [{ type: 'expression', priority: i + 1, formulae: [`AND(${anyFilled},$${L}5="")`],
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.risk100 } } } }],
    });
  });

  /* The same national id twice is two people or one stale row — flag both. */
  const idCol = spec.columns.findIndex((c) => c.kind.t === 'id');
  if (kind === 'ROSTER' && idCol >= 0) {
    const L = col(idCol);
    ws.addConditionalFormatting({
      ref: `${L}5:${L}${last}`,
      rules: [{ type: 'expression', priority: 50,
        formulae: [`AND($${L}5<>"",COUNTIF($${L}$5:$${L}$${last},$${L}5)>1)`],
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.warn200 } },
          font: { color: { argb: C.warn700 }, bold: true } } }],
    });
  }

  ws.autoFilter = { from: 'A4', to: `${col(n - 1)}4` };

  listsSheet(wb, {
    L_TRACK: TRACKS_AR,
    L_HALAQA: [...new Set(lists.halaqat)].sort((a, b) => a.localeCompare(b, 'ar')),
    L_STUDENT: [...new Set(lists.students)].sort((a, b) => a.localeCompare(b, 'ar')),
    L_GRADE: ALL_GRADES,
    L_STAGE: [...STAGES],
    L_NATION: ['سعودي', 'غير سعودي'],
    L_EXAM: EXAM_TYPES,
    L_TOPIC: lists.tajweedTopics.length ? lists.tajweedTopics : ['النون الساكنة والتنوين'],
    L_LEVEL: LEVELS,
    L_YESNO: ['نعم', 'لا'],
  });
  return finish(wb, spec.file);
}

async function finish(wb: Workbook, fileName: string) {
  /* The sheet to fill opens first, not the cover. */
  const target = wb.worksheets.findIndex((w) => w.name !== 'اقرأني' && w.state !== 'hidden');
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: Math.max(target, 0), visibility: 'visible' }];
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: buffer as ArrayBuffer, fileName };
}

/** Hand the built file to the browser as a download. */
export function saveFile({ buffer, fileName }: { buffer: ArrayBuffer; fileName: string }) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

