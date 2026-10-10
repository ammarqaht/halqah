'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   ما يُطبع من كل تقرير — chosen by the supervisor, report by report.

   «خلني اقدر اختار وش اطبع … وابيك ترجع كل التقارير وتعدل عليهم قضية اني
   اختار وش ابي اطبع على كيفي» (client, 10 Oct 2026).

   A report is SECTIONS (the student's file, the period, the association's
   figures) or COLUMNS (a halaqa's sheet, its points list) — either way a list
   of parts with an id, a label, and whether it is in by default. The reports
   panel shows them as switches; the choice rides in the URL as `?parts=a,b`
   so the preview and the print are the same sheet; and each print page asks
   `useParts(report)(id)` before drawing a part. No `parts` means the defaults,
   so every link printed before this still prints what it always did.
   ───────────────────────────────────────────────────────────────────────── */
import { useSearchParams } from 'next/navigation';

export type Part = { id: string; label: string; off?: boolean };
export type PartsSpec = { kind: 'sections' | 'columns'; parts: Part[] };

export const REPORT_PARTS: Record<string, PartsSpec> = {
  student: { kind: 'sections', parts: [
    { id: 'info',       label: 'بيانات الطالب' },
    { id: 'plan',       label: 'المستوى والخطة' },
    { id: 'exams',      label: 'الاختبارات' },
    { id: 'questions',  label: 'أسئلة الاختبارات وأخطاؤها', off: true },
    { id: 'points',     label: 'رصيد النقاط' },
    { id: 'ledger',     label: 'آخر حركات النقاط' },
    { id: 'attendance', label: 'ملخّص الحضور والتسميع' },
    { id: 'days',       label: 'الحضور يومًا بيوم' },
    { id: 'ratel',      label: 'آخر لقطة أسبوعية', off: true },
  ] },
  halaqa: { kind: 'columns', parts: [
    { id: 'grade',      label: 'الصف' },
    { id: 'attendance', label: 'الحضور' },
    { id: 'level',      label: 'المستوى' },
    { id: 'issued',     label: 'استلم الخطة' },
    { id: 'lesson',     label: 'آخر درس' },
    { id: 'assoc',      label: 'اختبار الجمعية' },
    { id: 'lastExam',   label: 'آخر اختبار ودرجته' },
    { id: 'note',       label: 'ملاحظة الاختبار' },
  ] },
  points: { kind: 'columns', parts: [
    { id: 'balance',  label: 'الرصيد' },
    { id: 'lastMove', label: 'آخر حركة' },
  ] },
  ready: { kind: 'columns', parts: [
    { id: 'nid',     label: 'رقم الهوية' },
    { id: 'halaqa',  label: 'الحلقة' },
    { id: 'track',   label: 'المسار' },
    { id: 'level',   label: 'المستوى' },
    { id: 'ajza',    label: 'الجزء الجاهز' },
    { id: 'diamond', label: 'تاريخ اجتياز الماسي' },
    { id: 'notes',   label: 'ملاحظات الجمعية' },
  ] },
  association: { kind: 'sections', parts: [
    { id: 'tracks',        label: 'المسارات' },
    { id: 'stages',        label: 'المراحل الدراسية' },
    { id: 'nationalities', label: 'الجنسيات' },
    { id: 'exams',         label: 'حصيلة الاختبارات' },
    { id: 'halaqat',       label: 'الحلقات' },
  ] },
  period: { kind: 'sections', parts: [
    { id: 'summary',    label: 'الأرقام الرئيسة' },
    { id: 'exams',      label: 'حصيلة الاختبارات' },
    { id: 'attendance', label: 'الحضور والتسميع' },
    { id: 'points',     label: 'النقاط' },
    { id: 'halaqat',    label: 'الحلقات' },
    { id: 'list',       label: 'الاختبارات واحدًا واحدًا' },
  ] },
  progress: { kind: 'sections', parts: [
    { id: 'totals', label: 'المجموع لكل حلقة' },
    { id: 'tracks', label: 'المسارات في كل حلقة' },
  ] },
};

export const defaultsOf = (report: string) =>
  (REPORT_PARTS[report]?.parts ?? []).filter((p) => !p.off).map((p) => p.id);

/** Parse `?parts=` (or the association's older `?sections=`) into the set
    that is on. Absent ⇒ the report's defaults. */
export function partsFrom(report: string, raw: string | null): Set<string> {
  if (raw == null || raw === '') return new Set(defaultsOf(report));
  if (raw === 'none') return new Set();
  return new Set(raw.split(',').filter(Boolean));
}

/** For a print page: is this part on? */
export function useParts(report: string): (id: string) => boolean {
  const sp = useSearchParams();
  const on = partsFrom(report, sp.get('parts') ?? sp.get('sections'));
  return (id: string) => on.has(id);
}
