/* ─────────────────────────────────────────────────────────────────────────────
   الترتيب — the order the board is read in.

   Pure on purpose: it takes figures and returns places, so it can be tested
   without a database and reused by the printed لوحة الشرف if that sheet ever
   wants the same tie rule. Who is eligible to appear, and how much of the board
   a boy is allowed to see, are decided in `app/api/student/rank` — not here.

   Ties share a place and consume the ones beneath them — 1, 2, 2, 4 — because
   two boys on two hundred points are second together, and telling one of them
   he is third is a lie about a number they can both read off the wall.
   ───────────────────────────────────────────────────────────────────────── */

export type Scorer = { id: string; fullName: string; points: number };
export type Ranked = Scorer & { rank: number };

/** Best first. */
export function rankBoard(rows: Scorer[]): Ranked[] {
  /* Name breaks a tie so two renders of the same data agree; the RANK never
     moves with it. `localeCompare` under `ar` orders أ before ب rather than by
     code point, which is the order a reader expects. */
  const sorted = [...rows].sort((a, b) => b.points - a.points
    || a.fullName.localeCompare(b.fullName, 'ar'));

  let rank = 0;
  let seen = 0;
  let last: number | null = null;
  return sorted.map((r) => {
    seen += 1;
    if (r.points !== last) { rank = seen; last = r.points; }
    return { ...r, rank };
  });
}

/** Where one boy stands, and out of how many. `null` when he is not on it. */
export function standingOf(rows: Ranked[], id: string) {
  const mine = rows.find((r) => r.id === id);
  return mine ? { rank: mine.rank, total: rows.length, points: mine.points } : null;
}

/**
 * The slice of a long board worth sending: its head, and the boy's own
 * neighbourhood, with a gap between them where the rest would be.
 *
 * This is a privacy decision as much as a layout one. A boy ranked ninetieth
 * has no business receiving the other hundred and sixteen rows just so his
 * phone can scroll past them — so the window is cut on the SERVER, and what
 * the screen cannot show it is never given.
 */
export function boardWindow(
  rows: Ranked[],
  id: string,
  { head = 6, around = 2 }: { head?: number; around?: number } = {},
): { rows: Ranked[]; gapAfter: number | null } {
  const rest = rows.filter((r) => r.rank > 3);
  const at = rest.findIndex((r) => r.id === id);

  /* Near the top, or not on the board at all: one contiguous run, no gap. */
  if (at < 0 || at <= head + around) {
    return { rows: rest.slice(0, Math.max(head + around, at + around + 1)), gapAfter: null };
  }
  return {
    rows: [...rest.slice(0, head), ...rest.slice(at - around, at + around + 1)],
    gapAfter: head,
  };
}
