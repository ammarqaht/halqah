/* The templates are only worth anything if the importer reads them back as
   what they claim to be. Each one is built, re-read with SheetJS exactly as the
   upload pages read a file, and classified by the real detector. */
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { buildCurriculumTemplate, buildTableTemplate, DEFAULT_LEVELS, type TableKind } from './xlsx';
import { scanWorkbook } from '@/lib/importers/detect';
import { parseCurriculumWorkbook } from '@/lib/importers/curriculum';
import { readWorkbook } from '@/lib/importers/workbook';
import type { CurriculumDay } from '@/lib/types';

const lists = {
  students: ['أحمد محمد صالح الحصن', 'أسامة مصطفى محمد فايد'],
  halaqat: ['تحفيظ حسن محمد ماهر علي (العصر)'],
  tajweedTopics: ['النون الساكنة والتنوين'],
};

const read = (buf: ArrayBuffer) => XLSX.read(buf, { type: 'array', cellDates: true });

describe('table templates', () => {
  const expected: Record<TableKind, string> = {
    ROSTER: 'ROSTER', EXAMS: 'EXAMS', TAJWEED: 'TAJWEED', PLAN_LOG: 'PLAN_LOG',
  };
  for (const [kind, want] of Object.entries(expected) as [TableKind, string][]) {
    it(`${kind}: an empty template is recognised as ${want}, and nothing else is`, async () => {
      const { buffer } = await buildTableTemplate(kind, lists);
      const scans = scanWorkbook(read(buffer));
      expect(scans.map((s) => s.kind)).toEqual([want]);
      expect(scans[0].headerRow).toBe(3);           // banner rows 1–2, legend row 3, header row 4
    });
  }

  it('a filled roster row comes back as a student', async () => {
    const { buffer } = await buildTableTemplate('ROSTER', lists);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('الطلاب')!;
    const row = ws.getRow(5);
    ['خالد سعد علي القحطاني', '1123456789', 'فضي', 'تحفيظ حسن محمد ماهر علي (العصر)', 'أول متوسط']
      .forEach((v, i) => { row.getCell(i + 1).value = v; });
    const out = readWorkbook(read(await wb.xlsx.writeBuffer() as ArrayBuffer), 't.xlsx', []);
    expect(out.payload.students).toHaveLength(1);
    expect(out.payload.students[0]).toMatchObject({ fullName: 'خالد سعد علي القحطاني', nationalId: '1123456789', track: 'SILVER' });
    expect(out.payload.halaqat.map((h) => h.name)).toEqual(['تحفيظ حسن محمد ماهر علي (العصر)']);
  });

  it('a filled exam row matches its student and keeps its date', async () => {
    const { buffer } = await buildTableTemplate('EXAMS', lists);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('الاختبارات')!;
    const row = ws.getRow(5);
    row.getCell(1).value = 'أحمد محمد صالح الحصن';
    /* what Excel stores when someone types 2026/11/10 into a date cell */
    row.getCell(5).value = (Date.UTC(2026, 10, 10) - Date.UTC(1899, 11, 30)) / 864e5;
    row.getCell(5).numFmt = 'yyyy/mm/dd';
    row.getCell(6).value = 'الوسام الذهبي';
    row.getCell(7).value = 45;
    row.getCell(11).value = 95;
    row.getCell(14).value = 'نعم';
    const student = { id: 's1', fullName: 'أحمد محمد صالح الحصن', nationalId: null } as never;
    const out = readWorkbook(read(await wb.xlsx.writeBuffer() as ArrayBuffer), 't.xlsx', [student]);
    expect(out.payload.exams).toHaveLength(1);
    expect(out.payload.exams[0]).toMatchObject({ studentId: 's1', type: 'BADGE_GOLDEN', level: 45, score: 95, passed: true });
    /* SheetJS reads this cell as 23:59:08 on the 9th in UTC+3; the day must
       still come out as the 10th. */
    expect(out.payload.exams[0].takenOn).toBe('2026-11-10');
  });
});

describe('curriculum template', () => {
  it('an empty template parses to nothing — every level is blank and dropped', async () => {
    const { buffer } = await buildCurriculumTemplate();
    const parsed = parseCurriculumWorkbook(buffer);
    expect(parsed.map((p) => p.track).sort()).toEqual(['GOLDEN', 'SILVER']);
    for (const p of parsed) {
      expect(p.days).toHaveLength(0);
      expect(p.examDays).toHaveLength(0);
      expect(p.emptyLevels).toHaveLength(DEFAULT_LEVELS[p.track as 'SILVER' | 'GOLDEN'].length);
    }
  });

  it('the current curriculum round-trips through the template unchanged', async () => {
    const current: CurriculumDay[] = [];
    for (let day = 1; day <= 24; day++) {
      if (day === 12 || day === 24) continue;
      current.push({ track: 'SILVER', level: 60, dayNo: day, kind: 'MURAJAA_KUBRA', fromSurah: '', fromAyah: '', toSurah: '', toAyah: '', note: '' });
      current.push({ track: 'SILVER', level: 60, dayNo: day, kind: 'MURAJAA_SUGHRA', fromSurah: '', fromAyah: '', toSurah: '', toAyah: '', note: '' });
      current.push({ track: 'SILVER', level: 60, dayNo: day, kind: 'DARS', fromSurah: 'الناس', fromAyah: '1', toSurah: 'الإخلاص', toAyah: 'آخر', note: '' });
    }
    current.push({ track: 'SILVER', level: 60, dayNo: 24, kind: 'MURAJAA_KUBRA', fromSurah: '', fromAyah: '', toSurah: '', toAyah: '', note: 'اختبار الجمعية' });

    const { buffer, fileName } = await buildCurriculumTemplate(current);
    expect(fileName).toBe('منهج-الحفظ-الحالي.xlsx');
    const silver = parseCurriculumWorkbook(buffer).find((p) => p.track === 'SILVER')!;
    expect(silver.levels).toEqual([60]);
    expect(silver.issues).toEqual([]);                       // 22 days + 2 exam days = 24
    expect(silver.examDays.map((e) => [e.dayNo, e.badge, e.association]))
      .toEqual([[12, 'BADGE_GOLDEN', false], [24, 'BADGE_DIAMOND', true]]);
    const dars = silver.days.filter((d) => d.kind === 'DARS' && d.fromSurah);
    expect(dars).toHaveLength(22);
    expect(dars[0]).toMatchObject({ fromSurah: 'الناس', fromAyah: '1', toSurah: 'الإخلاص', toAyah: 'آخر' });
  });

  it('is classified as CURRICULUM by the multi-file upload too', async () => {
    const { buffer } = await buildCurriculumTemplate();
    const kinds = scanWorkbook(read(buffer)).map((s) => s.kind);
    expect(kinds).toEqual(['CURRICULUM', 'CURRICULUM']);
  });
});
