/* ─────────────────────────────────────────────────────────────────────────────
   مستوى الطالب — ONE answer, read the same way by every screen.

   «الطالب محمد عدلت المستوى حقه لكن في خانة الي اضبط له هو في اي يوم في
   المستوى لا يزال 48 ما تحدث … تاكد انه في كل مكان يتعدل مستواه» (client,
   2 Oct 2026).

   A boy's level is written in three places — the roster (`currentLevel`), his
   plans, and the teacher's pointer (`progress.level`) — and the screens read
   them in different orders: settings and the teacher's card took the pointer
   FIRST, so a level changed anywhere else left them on the old one.

   The rule, everywhere:
     · his level is the roster's, then his newest sheet's, then the pointer's —
       the roster is what the supervisor sets (api/admin/level, printing a new
       level's sheet), so it leads;
     · his sheet is the plan FOR that level, not merely the newest plan;
     · the pointer (which مقرّر) only counts while it is on that level. One left
       on the previous level is stale — «day 14» of level 48 means nothing on
       level 47 — so it reads as unset rather than as a wrong day.
   ───────────────────────────────────────────────────────────────────────── */

type PlanLike = { level: number; track: string; issuedAt: string };
type ProgressLike = { level: number | null; assignmentNo: number | null; awaitingExam?: string | null } | null | undefined;

/** Newest by `issuedAt` — how every portal has always found «his sheet». */
export function newestPlan<P extends PlanLike>(plans: P[]): P | null {
  let best: P | null = null;
  for (const p of plans) if (!best || p.issuedAt > best.issuedAt) best = p;
  return best;
}

export function levelOf(
  s: { currentLevel: number | null; progress?: ProgressLike },
  plans: PlanLike[] = [],
): number | null {
  return s.currentLevel ?? newestPlan(plans)?.level ?? s.progress?.level ?? null;
}

/** The sheet he is on: the plan for his level, or — when nothing names a level
    — the newest one. A newer sheet for ANOTHER level (an edit, a reprint for a
    different boy's level) does not make it his. */
export function planOf<P extends PlanLike>(
  s: { currentLevel: number | null; track?: string | null; progress?: ProgressLike },
  plans: P[],
): P | null {
  const level = levelOf(s, plans);
  if (level == null) return newestPlan(plans);
  const matching = plans.filter((p) => p.level === level && (!s.track || p.track === s.track));
  return newestPlan(matching);
}

/** The pointer, if it is on his current level; null when it was left behind. */
export function pointerOf(
  s: { currentLevel: number | null; progress?: ProgressLike },
  plans: PlanLike[] = [],
): { assignmentNo: number | null; awaitingExam: string | null } | null {
  const p = s.progress;
  if (!p) return null;
  const level = levelOf(s, plans);
  if (p.level != null && level != null && p.level !== level) return null;
  return { assignmentNo: p.assignmentNo, awaitingExam: p.awaitingExam ?? null };
}
