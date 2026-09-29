/* الغياب التلقائي — the rule, with no database in it, so it can be tested.

   «إذا عدّا يوم من تسجيل حضور الطلاب وما حُضِّر الطالب يتغيّب بشكل أوتوماتيكي،
   بس ما يصيرون غايبين إلا إذا كان فيه طلاب حاضرين» (client, 29 Sep 2026).

   So a day becomes absences only when BOTH hold:
   - it has passed — today is still being registered, and a boy not yet ticked
     at half past four is not absent;
   - the halaqa met — at least one of its boys was marked حاضر or متأخر that day.
     A day with no one present is a day the halaqa did not sit (a holiday, a
     teacher away with no one covering), and filling it with a whole roster of
     absences would be the lie the register's footnote warned against.

   What it writes is an ordinary ABSENT card, signed as the system's. The teacher
   corrects it the way he corrects any card — he opens that day and marks the boy
   present — and the revision log keeps what it replaced. */

export const AUTO_ABSENT_ROLE = 'SYSTEM';
export const AUTO_ABSENT_NAME = 'غياب تلقائي';

/** How far back the rule reaches. Two weeks covers a teacher who registers late;
    it does not rewrite a term that was kept on paper before the portal. */
export const AUTO_ABSENT_LOOKBACK_DAYS = 14;

type Entry = { studentId: string; halaqaId: string | null; day: string; status: string };
/** `since`: the first day he could have been absent — the day he was added. */
type Boy = { id: string; halaqaId: string | null; since: string };

export function planAbsences(args: {
  entries: Entry[];
  roster: Boy[];
  /** `YYYY-MM-DD`; only days strictly before it are considered. */
  today: string;
  /** `YYYY-MM-DD`; the earliest day considered. */
  from: string;
}): { studentId: string; halaqaId: string; day: string }[] {
  const { entries, roster, today, from } = args;

  /* The halaqa-days that met, and every boy who already has a card on a day. */
  const met = new Set<string>();
  const carded = new Set<string>();
  for (const e of entries) {
    carded.add(`${e.studentId}|${e.day}`);
    if (e.halaqaId && e.day < today && e.day >= from
      && (e.status === 'PRESENT' || e.status === 'LATE')) {
      met.add(`${e.halaqaId}|${e.day}`);
    }
  }

  const out: { studentId: string; halaqaId: string; day: string }[] = [];
  for (const key of [...met].sort()) {
    const [halaqaId, day] = key.split('|');
    for (const b of roster) {
      if (b.halaqaId !== halaqaId) continue;
      /* A boy added on Tuesday was not absent on Sunday. */
      if (b.since > day) continue;
      if (carded.has(`${b.id}|${day}`)) continue;
      out.push({ studentId: b.id, halaqaId, day });
    }
  }
  return out;
}
