/* What an import will actually DO, worked out before anything is written.
   A second upload of the same file is the normal case, not the exception: the
   supervisor pulls a fresh Ratel report every week or two. So the question is
   never "add these rows" but "what changed since last time" — and he has to be
   able to see the answer before he agrees to it. */
import type { Student, Halaqa } from '@/lib/types';
import { TRACK_AR, STATUS_AR } from '@/lib/types';
import type { ParsedRow, RowIssue } from './roster';

export type FieldChange = { field: string; label: string; from: string; to: string };

export type RowPlan =
  | { kind: 'CREATE';    row: ParsedRow; changes: []                }
  | { kind: 'UPDATE';    row: ParsedRow; changes: FieldChange[]; existing: Student }
  | { kind: 'UNCHANGED'; row: ParsedRow; changes: []; existing: Student };

export type ImportPlan = {
  rows: RowPlan[];
  creates: number;
  updates: number;
  unchanged: number;
  /** In the database but absent from this file. Never deleted — surfaced. */
  missing: Student[];
  newHalaqat: Halaqa[];
  knownHalaqat: Halaqa[];
  flagged: number;
};

/* Only the fields a roster/Ratel file can legitimately set. Anything the system
   owns — level, points, status — is never touched by an import. */
const TRACKED: { field: keyof Student; label: string; fmt?: (v: unknown) => string }[] = [
  { field: 'fullName',      label: 'الاسم' },
  { field: 'nationalId',    label: 'رقم الهوية' },
  { field: 'halaqaId',      label: 'الحلقة' },
  { field: 'track',         label: 'المسار', fmt: (v) => (v ? TRACK_AR[v as keyof typeof TRACK_AR] ?? String(v) : '—') },
  { field: 'grade',         label: 'الصف' },
  { field: 'stage',         label: 'المرحلة' },
  { field: 'nationality',   label: 'الجنسية' },
  { field: 'guardianPhone', label: 'جوال ولي الأمر' },
  { field: 'attended',      label: 'الحضور', fmt: (v) => (v === undefined ? '—' : v ? 'حاضر' : 'غائب') },
  { field: 'hifzPages',     label: 'أوجه الحفظ' },
  { field: 'reviewPages',   label: 'أوجه المراجعة' },
];

const show = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : String(v);

export function buildPlan(
  rows: ParsedRow[],
  incomingHalaqat: Halaqa[],
  existingStudents: Student[],
  existingHalaqat: Halaqa[],
  halaqaLabel: (id: string | null) => string,
): ImportPlan {
  const byKey = new Map(existingStudents.map((s) => [s.dedupeKey || s.nationalId || s.fullName, s]));
  const knownNames = new Set(existingHalaqat.map((h) => h.name));

  const seen = new Set<string>();
  const plan: RowPlan[] = [];

  for (const row of rows) {
    const key = row.student.dedupeKey || row.student.nationalId || row.student.fullName;
    seen.add(key);
    const existing = byKey.get(key);

    if (!existing) { plan.push({ kind: 'CREATE', row, changes: [] }); continue; }

    const changes: FieldChange[] = [];
    for (const t of TRACKED) {
      const next = row.student[t.field];
      /* An import only sets what its file carries. A Ratel report has no
         «المسار» column — silence there means "unchanged", not "clear it". */
      if (next === null || next === undefined || next === '') continue;

      const prev = existing[t.field];
      if (String(prev ?? '') === String(next)) continue;

      const fmt = t.fmt ?? show;
      const from = t.field === 'halaqaId' ? halaqaLabel(prev as string | null) : fmt(prev);
      const to   = t.field === 'halaqaId' ? halaqaLabel(next as string | null) : fmt(next);
      if (from === to) continue;
      changes.push({ field: String(t.field), label: t.label, from, to });
    }

    plan.push(changes.length
      ? { kind: 'UPDATE', row, changes, existing }
      : { kind: 'UNCHANGED', row, changes: [], existing });
  }

  const missing = existingStudents.filter(
    (s) => !seen.has(s.dedupeKey || s.nationalId || s.fullName));

  return {
    rows: plan,
    creates:   plan.filter((p) => p.kind === 'CREATE').length,
    updates:   plan.filter((p) => p.kind === 'UPDATE').length,
    unchanged: plan.filter((p) => p.kind === 'UNCHANGED').length,
    missing,
    newHalaqat:   incomingHalaqat.filter((h) => !knownNames.has(h.name)),
    knownHalaqat: incomingHalaqat.filter((h) => knownNames.has(h.name)),
    flagged: rows.filter((r) => r.issues.length).length,
  };
}

/* Where each recognised column lands. Shown in the preview so the supervisor
   can see that a file serving several purposes is being split correctly —
   the Ratel report carries roster fields AND the weekly snapshot at once. */
export const COLUMN_DESTINATION: Record<string, { label: string; group: DestGroup }> = {
  name:        { label: 'اسم الطالب',        group: 'STUDENT' },
  nationalId:  { label: 'رقم الهوية',        group: 'STUDENT' },
  track:       { label: 'المسار',            group: 'STUDENT' },
  grade:       { label: 'الصف',              group: 'STUDENT' },
  stage:       { label: 'المرحلة',           group: 'STUDENT' },
  nationality: { label: 'الجنسية',           group: 'STUDENT' },
  phone:       { label: 'جوال ولي الأمر',    group: 'STUDENT' },
  halaqa:      { label: 'الحلقة',            group: 'HALAQA'  },
  hifzTeacher: { label: 'معلم الحلقة',       group: 'HALAQA'  },
  mosque:      { label: 'المسجد',            group: 'HALAQA'  },
  attended:    { label: 'الحضور',            group: 'SNAPSHOT' },
  hifzPages:   { label: 'أوجه الحفظ',        group: 'SNAPSHOT' },
  reviewPages: { label: 'أوجه المراجعة',     group: 'SNAPSHOT' },
};

export type DestGroup = 'STUDENT' | 'HALAQA' | 'SNAPSHOT';

export const DEST_LABEL: Record<DestGroup, string> = {
  STUDENT:  'بيانات الطالب',
  HALAQA:   'الحلقات',
  SNAPSHOT: 'لقطة رتل الأسبوعية',
};
