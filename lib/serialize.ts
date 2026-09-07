/* Prisma hands back Decimal and Date; the client wants plain JSON. One place
   for the conversion so no screen has to know the difference. */
import type { Student, Halaqa, Track, StudentStatus, IdFlag } from './types';

type DbStudent = {
  id: string; fullName: string; nationalId: string | null; nationalIdFlag: string | null;
  dedupeKey: string | null; track: string | null; halaqaId: string | null;
  grade: string; stage: string; nationality: string; guardianPhone: string;
  status: string; currentLevel: number | null;
  attended: boolean | null; hifzPages: unknown; reviewPages: unknown;
};

const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

export const toStudent = (s: DbStudent): Student => ({
  id: s.id,
  fullName: s.fullName,
  nationalId: s.nationalId,
  nationalIdFlag: (s.nationalIdFlag ?? null) as IdFlag,
  dedupeKey: s.dedupeKey ?? undefined,
  track: (s.track ?? null) as Track | null,
  halaqaId: s.halaqaId,
  grade: s.grade,
  stage: s.stage,
  nationality: s.nationality,
  guardianPhone: s.guardianPhone,
  status: s.status as StudentStatus,
  currentLevel: s.currentLevel,
  attended: s.attended ?? undefined,
  hifzPages: num(s.hifzPages),
  reviewPages: num(s.reviewPages),
});

type DbHalaqa = {
  id: string; name: string; teacher: string; mosque: string;
  timeSlot: string; track: string | null; notes: string | null;
};

export const toHalaqa = (h: DbHalaqa): Halaqa => ({
  id: h.id, name: h.name, teacher: h.teacher, mosque: h.mosque,
  timeSlot: h.timeSlot, track: (h.track ?? null) as Track | null,
  notes: h.notes ?? undefined,
});
