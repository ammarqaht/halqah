'use client';
import { useEffect, useState } from 'react';

/* Who is signed in, for the screens that address him by name.

   The name has been in the session token since there was a session; nothing
   ever asked for it, so الرئيسية greeted every supervisor as «أبا عبدالله» —
   fine while there was one account, wrong the moment there were four. */
let cached: string | null = null;

export function useMyName(): string | null {
  const [name, setName] = useState<string | null>(cached);
  useEffect(() => {
    if (cached !== null) return;
    let live = true;
    fetch('/api/admin/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.name) return;
        cached = String(d.name);
        setName(cached);
      })
      .catch(() => { /* a greeting is not worth an error */ });
    return () => { live = false; };
  }, []);
  return name;
}

/** «مساء الخير» after Asr, «صباح الخير» before — the supervisor opens this
    after the afternoon prayer, but he is not the only one who opens it. */
export function greeting(at = new Date()): string {
  const h = at.getHours();
  if (h < 12) return 'صباح الخير';
  return 'مساء الخير';
}

/** The first name, for a greeting.

    Taking «the first two words» split «محمد عبد الرحمن» into «محمد عبد» — عبد
    is bound to what follows it and is never a name on its own. So: one word,
    unless that word is one that cannot stand alone. */
const BOUND = new Set(['عبد', 'عبدال', 'أبو', 'ابو', 'أبا', 'ابا', 'أم', 'ام', 'ابن', 'بن']);

export function shortGreetingName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return BOUND.has(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
}
