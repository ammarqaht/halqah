/* One lockout for the supervisor's password, whichever door it is tried at.

   It is accepted at two sign-ins since 26 Oct 2026 — his own, and the
   teacher's portal when he stands in for an absent teacher. Two counters would
   have been twice the guesses. So one map, and two keys per attempt: the
   username with the address, and the username alone across every address — a
   spoofed `x-forwarded-for` buys a fresh first key, never the second. Kept in
   memory, like the counter it replaces: one container serves the site. */
const WINDOW = 15 * 60_000;
const MAX_PER_IP = 8;
const MAX_PER_USER = 20;
const attempts = new Map<string, { n: number; until: number }>();

const keysFor = (username: string, ip: string) =>
  [{ k: `u:${username}|${ip}`, max: MAX_PER_IP }, { k: `u:${username}`, max: MAX_PER_USER }];

const live = (k: string) => {
  const r = attempts.get(k);
  if (r && Date.now() >= r.until) { attempts.delete(k); return null; }
  return r ?? null;
};

export const ipOf = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

export function isLocked(username: string, ip: string) {
  return keysFor(username, ip).some(({ k, max }) => (live(k)?.n ?? 0) >= max);
}

export function recordFailure(username: string, ip: string) {
  for (const { k } of keysFor(username, ip)) {
    const r = live(k);
    attempts.set(k, { n: (r?.n ?? 0) + 1, until: Date.now() + WINDOW });
  }
  /* Bounded: a flood of invented usernames must not grow it forever. */
  if (attempts.size > 5000) for (const k of attempts.keys()) live(k);
}

export function clearFailures(username: string, ip: string) {
  for (const { k } of keysFor(username, ip)) attempts.delete(k);
}

export const LOCKED_AR = 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.';
