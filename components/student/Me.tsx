'use client';
/* Who is signed in, fetched once and shared.
   Nothing under app/student imports lib/store — every byte a boy's browser
   holds is his own, resolved from the cookie on the server. */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type Me = {
  id: string; fullName: string; username: string;
  halaqaName: string | null; teacher: string | null;
  track: 'SILVER' | 'GOLDEN' | 'TALQEEN' | null; trackAr: string | null;
  grade: string | null; stage: string | null;
  currentLevel: number | null; ajza: number | null; ajzaWhole: number | null;
  levelTotal: number; progressPct: number;
  eligibleForPoints: boolean; balance: number;
  mustChangePin: boolean; attendedDays: number | null;
  nextExam: {
    scheduledOn: string;
    badge: 'BADGE_GOLDEN' | 'BADGE_DIAMOND';
    level: number | null;
    daysAway: number;
  } | null;
};

const Ctx = createContext<{ me: Me | null; reload: () => void }>({ me: null, reload: () => {} });
export const useMe = () => useContext(Ctx);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();

  const reload = useCallback(() => {
    fetch('/api/student/me')
      .then((r) => {
        if (r.status === 401) { router.replace('/student/login'); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => { if (d) setMe(d); })
      .catch(() => { /* the screen shows its own error state */ });
  }, [router]);

  useEffect(() => { reload(); }, [reload]);

  return <Ctx.Provider value={{ me, reload }}>{children}</Ctx.Provider>;
}
