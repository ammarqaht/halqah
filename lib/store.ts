'use client';
/* Client-side store — a stand-in for Prisma until BUILD_PLAN phase 1 lands.
   It starts EMPTY on purpose: the supervisor populates it by importing his own
   workbook, which is the only honest way to test the importer. */
import { useSyncExternalStore } from 'react';
import type { Student, Halaqa } from './types';

export type DB = { students: Student[]; halaqat: Halaqa[]; importedAt: string | null; sourceFile: string | null };

const EMPTY: DB = { students: [], halaqat: [], importedAt: null, sourceFile: null };
const KEY = 'halqah.db.v1';

let db: DB = EMPTY;
let loaded = false;
const subs = new Set<() => void>();

function load(): DB {
  if (loaded) return db;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = { ...EMPTY, ...JSON.parse(raw) };
  } catch { /* private mode — stay in memory */ }
  return db;
}

function commit(next: DB) {
  db = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  subs.forEach((f) => f());
}

export const store = {
  get: () => load(),
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },

  replaceAll(students: Student[], halaqat: Halaqa[], sourceFile: string) {
    commit({ students, halaqat, importedAt: new Date().toISOString(), sourceFile });
  },
  /** Imports add and update; they never delete. SPEC.md §5.
      Two things this has to get right:
      1. Each parse mints fresh halaqa ids, so an incoming student's halaqaId
         points into ITS OWN batch. Halaqat are deduped by name, so those ids
         must be translated to the surviving halaqa or every link dangles.
      2. Identity is the national id, but two rows in one file can legitimately
         share one (the roster has such a pair). Both must survive, so the
         parser hands us a dedupeKey that disambiguates within a batch. */
  merge(students: Student[], halaqat: Halaqa[], sourceFile: string) {
    const cur = load();

    const halMap = new Map(cur.halaqat.map((h) => [h.name, h]));
    const incomingIdToName = new Map(halaqat.map((h) => [h.id, h.name]));
    for (const h of halaqat) if (!halMap.has(h.name)) halMap.set(h.name, h);
    const canonicalId = (incomingId: string | null) => {
      if (!incomingId) return null;
      const name = incomingIdToName.get(incomingId);
      return name ? halMap.get(name)!.id : incomingId;
    };

    const keyOf = (s: Student) => s.dedupeKey || s.nationalId || s.fullName;
    const byKey = new Map(cur.students.map((s) => [keyOf(s), s]));

    for (const raw of students) {
      const s: Student = { ...raw, halaqaId: canonicalId(raw.halaqaId) };
      const k = keyOf(s);
      const prev = byKey.get(k);
      if (!prev) { byKey.set(k, s); continue; }
      /* An import updates only what its file actually carries. A Ratel report
         has no «المسار» column — it must not wipe the track a roster set. */
      const patch: Partial<Student> = {};
      for (const [key, val] of Object.entries(s) as [keyof Student, unknown][]) {
        if (key === 'id') continue;
        if (val === null || val === undefined || val === '') continue;
        (patch as Record<string, unknown>)[key] = val;
      }
      byKey.set(k, { ...prev, ...patch, id: prev.id });
    }

    commit({ students: [...byKey.values()], halaqat: [...halMap.values()],
             importedAt: new Date().toISOString(), sourceFile });
  },
  upsertHalaqa(h: Halaqa) {
    const cur = load();
    const i = cur.halaqat.findIndex((x) => x.id === h.id);
    const halaqat = i >= 0 ? cur.halaqat.map((x) => (x.id === h.id ? h : x)) : [...cur.halaqat, h];
    commit({ ...cur, halaqat });
  },
  removeHalaqa(id: string) {
    const cur = load();
    commit({ ...cur,
      halaqat: cur.halaqat.filter((h) => h.id !== id),
      students: cur.students.map((s) => (s.halaqaId === id ? { ...s, halaqaId: null } : s)) });
  },
  upsertStudent(s: Student) {
    const cur = load();
    const i = cur.students.findIndex((x) => x.id === s.id);
    const students = i >= 0 ? cur.students.map((x) => (x.id === s.id ? s : x)) : [...cur.students, s];
    commit({ ...cur, students });
  },
  /** Moving a student carries all their history — nothing resets. SPEC.md §6.3 */
  moveStudents(ids: string[], halaqaId: string | null) {
    const cur = load();
    const set = new Set(ids);
    commit({ ...cur, students: cur.students.map((s) => (set.has(s.id) ? { ...s, halaqaId } : s)) });
  },
  reset() { commit(EMPTY); },
};

export function useDB(): DB {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
