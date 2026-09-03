'use client';
/* The screens' view of the data. It used to live in localStorage, which meant
   an upload filled one browser tab and reached nothing else. It now reads and
   writes the server, so a file uploaded once is what every screen sees —
   including on the supervisor's own machine.

   The shape of `useDB()` is unchanged, so no screen had to be rewritten. */
import { useSyncExternalStore } from 'react';
import type { Student, Halaqa } from './types';

export type DB = {
  students: Student[];
  halaqat: Halaqa[];
  importedAt: string | null;
  sourceFile: string | null;
  loading: boolean;
  error: string | null;
};

const EMPTY: DB = {
  students: [], halaqat: [], importedAt: null, sourceFile: null,
  loading: true, error: null,
};

let db: DB = EMPTY;
let started = false;
const subs = new Set<() => void>();

const emit = () => subs.forEach((f) => f());

async function refresh() {
  try {
    const r = await fetch('/api/data', { cache: 'no-store' });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      db = { ...db, loading: false, error: d.error ?? 'تعذّر تحميل البيانات' };
      emit(); return;
    }
    const d = await r.json();
    db = {
      students: d.students ?? [], halaqat: d.halaqat ?? [],
      importedAt: d.importedAt ?? null, sourceFile: d.sourceFile ?? null,
      loading: false, error: null,
    };
  } catch {
    db = { ...db, loading: false, error: 'تعذّر الاتصال بالخادم' };
  }
  emit();
}

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'تعذّرت العملية');
  await refresh();
  return d;
}

export const store = {
  get: () => db,
  subscribe(f: () => void) {
    subs.add(f);
    if (!started) { started = true; refresh(); }
    return () => { subs.delete(f); };
  },
  refresh,
  upsertStudent: (s: Student) => send('/api/students', 'POST', s),
  moveStudents: (ids: string[], halaqaId: string | null) =>
    send('/api/students', 'PATCH', { ids, halaqaId }),
  upsertHalaqa: (h: Halaqa & { applyTrackToStudents?: boolean }) =>
    send('/api/halaqat', 'POST', h),
  removeHalaqa: (id: string) => send('/api/halaqat', 'DELETE', { id }),
  commitImport: (payload: {
    students: Student[]; halaqat: Halaqa[];
    fileName: string; sheetName: string; kind: string;
  }) => send('/api/import', 'POST', payload),
  reset: () => refresh(),
};

export function useDB(): DB {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
