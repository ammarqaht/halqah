import { db } from '@/lib/db';

/* مقرّر اليوم — سوره وآياته، كما في ورقته.
 *
 * `day_entries` records WHICH مقرّر was recited — its number, level and track —
 * and `recitation_lines` records whether each of its three lines was. Neither
 * carries the passage: that is the curriculum's, keyed by the same four
 * columns, and duplicating it onto every afternoon would mean an edited منهج
 * stopped matching what the screens show.
 *
 * So it is joined at read time. «سمّع الدرس» becomes «الدرس — البقرة ١ إلى
 * البقرة ٥», which is what a supervisor is actually asking when he opens a day.
 */

export type Passage = {
  fromSurah: string; fromAyah: string;
  toSurah: string; toAyah: string;
  note: string;
};

/** `${track}|${level}|${dayNo}|${kind}` → the passage. */
export type PassageMap = Map<string, Passage>;

export const passageKey = (
  track: string | null, level: number | null, dayNo: number | null, kind: string,
) => `${track ?? ''}|${level ?? ''}|${dayNo ?? ''}|${kind}`;

/**
 * One query for every (track, level) the entries touch — not one per entry.
 * A halaqa's week spans a handful of levels however many boys are in it, and a
 * round trip per row against a remote database is what made other screens slow.
 */
export async function passagesFor(
  entries: { track: string | null; level: number | null; assignmentNo: number | null }[],
): Promise<PassageMap> {
  const pairs = new Map<string, { track: string; level: number }>();
  for (const e of entries) {
    if (!e.track || e.level == null || e.assignmentNo == null) continue;
    pairs.set(`${e.track}|${e.level}`, { track: e.track, level: e.level });
  }
  if (pairs.size === 0) return new Map();

  const rows = await db.curriculumDay.findMany({
    where: { OR: [...pairs.values()] },
    select: {
      track: true, level: true, dayNo: true, kind: true,
      fromSurah: true, fromAyah: true, toSurah: true, toAyah: true, note: true,
    },
  });

  const out: PassageMap = new Map();
  for (const r of rows) {
    out.set(passageKey(r.track, r.level, r.dayNo, r.kind), {
      fromSurah: r.fromSurah, fromAyah: r.fromAyah,
      toSurah: r.toSurah, toAyah: r.toAyah, note: r.note,
    });
  }
  return out;
}

/** «البقرة ١ — البقرة ٥»، أو «البقرة ١ — ٥» حين السورة واحدة. Empty ⇒ null,
    never a dash pretending to be a passage. */
export function passageLabel(p: Passage | undefined): string | null {
  if (!p) return null;
  const from = [p.fromSurah, p.fromAyah].filter(Boolean).join(' ');
  const to = p.fromSurah && p.fromSurah === p.toSurah
    ? p.toAyah
    : [p.toSurah, p.toAyah].filter(Boolean).join(' ');
  if (!from && !to) return null;
  if (!to) return from;
  return `${from} — ${to}`;
}
