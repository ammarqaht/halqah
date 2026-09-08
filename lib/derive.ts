/* Aggregates computed from whatever the supervisor has imported.
   Replaces the seeded snapshot: every figure below is his own data. */
import { nationalityBand } from '@/lib/types';
import type { DB } from './store';
import { TRACK_AR, type Student } from './types';

export function derive(db: DB) {
  const s = db.students;
  const active = s.filter((x) => x.status === 'ACTIVE');
  /* Statistics describe who is IN the halaqa. A student who stopped coming is
     kept in the system — his exams, his level and his points are all still
     there for the day he returns — but counting him among the tracks and
     stages would report a halaqa that no longer exists. */
  const count = <K extends string>(pick: (x: Student) => K | null | undefined) => {
    const m: Record<string, number> = {};
    for (const x of active) { const k = pick(x); if (k) m[k] = (m[k] ?? 0) + 1; }
    return m;
  };

  const byHalaqa = db.halaqat.map((h) => {
    const list = s.filter((x) => x.halaqaId === h.id);
    /* Both figures, because the client's own sheet carries the TOTAL and this
       screen carried only the average — so «٢٠٨٫٦٦» in his file and «١٣٫٩١»
       here described the same halaqa and looked like a contradiction. They are
       the same number over fifteen students. */
    const vals = (f: (x: Student) => number | undefined) =>
      list.map(f).filter((n): n is number => typeof n === 'number');
    const sum = (f: (x: Student) => number | undefined) =>
      vals(f).reduce((a, b) => a + b, 0);
    const avg = (f: (x: Student) => number | undefined) => {
      const v = vals(f);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };
    const marked = list.filter((x) => x.attendedDays !== undefined);
    return {
      ...h,
      n: list.length,
      hp: avg((x) => x.hifzPages),
      rp: avg((x) => x.reviewPages),
      /** The totals, as رتل reports them — what the client's sheet shows. */
      hpTotal: sum((x) => x.hifzPages),
      rpTotal: sum((x) => x.reviewPages),
      attTotal: list.reduce((n, x) => n + (x.attendedDays ?? 0), 0),
      /* Average DAYS attended. It used to be «what share of them showed up»
         computed from a yes/no that was itself wrong — the column is a count. */
      att: marked.length
        ? Math.round((marked.reduce((n, x) => n + (x.attendedDays ?? 0), 0) / marked.length) * 10) / 10
        : null,
      tracks: list.reduce<Record<string, number>>((m, x) => {
        if (x.track) m[TRACK_AR[x.track]] = (m[TRACK_AR[x.track]] ?? 0) + 1; return m;
      }, {}),
    };
  }).sort((a, b) => b.n - a.n);

  const orphans = s.filter((x) => !x.halaqaId).length;
  const flagged = s.filter((x) => x.nationalIdFlag).length;

  return {
    isEmpty: s.length === 0,
    students: s.length,
    activeStudents: active.length,
    halaqat: db.halaqat.length,
    tracks: count((x) => (x.track ? TRACK_AR[x.track] : null)),
    stages: count((x) => x.stage || null),
    nationalities: count((x) => nationalityBand(x.nationality)),
    byHalaqa, orphans, flagged,
    importedAt: db.importedAt, sourceFile: db.sourceFile,
  };
}
