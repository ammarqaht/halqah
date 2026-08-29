/* Aggregates computed from whatever the supervisor has imported.
   Replaces the seeded snapshot: every figure below is his own data. */
import type { DB } from './store';
import { TRACK_AR, type Student } from './types';

export function derive(db: DB) {
  const s = db.students;
  const active = s.filter((x) => x.status === 'ACTIVE');
  const count = <K extends string>(pick: (x: Student) => K | null | undefined) => {
    const m: Record<string, number> = {};
    for (const x of s) { const k = pick(x); if (k) m[k] = (m[k] ?? 0) + 1; }
    return m;
  };

  const byHalaqa = db.halaqat.map((h) => {
    const list = s.filter((x) => x.halaqaId === h.id);
    const avg = (f: (x: Student) => number | undefined) => {
      const v = list.map(f).filter((n): n is number => typeof n === 'number');
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };
    const marked = list.filter((x) => x.attended !== undefined);
    return {
      ...h,
      n: list.length,
      hp: avg((x) => x.hifzPages),
      rp: avg((x) => x.reviewPages),
      att: marked.length ? Math.round((marked.filter((x) => x.attended).length / marked.length) * 100) : null,
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
    nationalities: count((x) => x.nationality || null),
    byHalaqa, orphans, flagged,
    importedAt: db.importedAt, sourceFile: db.sourceFile,
  };
}
