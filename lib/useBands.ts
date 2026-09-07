'use client';
/* The two lists, read once per screen that offers them.
   A hook rather than a prop drilled through four dialogs: the dropdowns sit
   deep inside modals whose parents have no business knowing about settings. */
import { useEffect, useState } from 'react';
import {
  REASONS_KEY, PURPOSES_KEY, DEFAULT_REASONS, DEFAULT_PURPOSES, readList,
} from '@/lib/settings';

let cache: { reasons: string[]; purposes: string[] } | null = null;

export function useBands() {
  const [bands, setBands] = useState(cache ?? { reasons: DEFAULT_REASONS, purposes: DEFAULT_PURPOSES });

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : {}) as Promise<Record<string, unknown>>)
      .then((all) => {
        cache = {
          reasons: readList(all?.[REASONS_KEY], DEFAULT_REASONS),
          purposes: readList(all?.[PURPOSES_KEY], DEFAULT_PURPOSES),
        };
        if (alive) setBands(cache);
      })
      .catch(() => { /* the approved lists stand */ });
    return () => { alive = false; };
  }, []);

  return bands;
}
