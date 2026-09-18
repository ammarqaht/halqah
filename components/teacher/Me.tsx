'use client';
/* Who is signed in, and the state of today — fetched once and shared.
   Nothing under app/teacher imports lib/store: every byte a teacher's browser
   holds belongs to ONE halaqa, resolved from the cookie on the server. That
   discipline is the whole reason the student portal has no data leaks, and it
   matters more here, where the next halaqa's roster is one id away. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type Alert = {
  kind: 'EXAM_DUE' | 'BOOKED' | 'RESULT' | 'PLAN' | 'ABSENCE' | 'MESSAGE';
  /** Stable while the alert means the same thing — what its read-marker uses. */
  key: string;
  read: boolean;
  href: string;
  body: string;
  studentId?: string;
  /** The day the alert is ABOUT — «يكون معها تاريخ التنبيه» (client, 18 Sep
      2026). Every kind carries one, and they are ordered by it. */
  at?: string;
};

/* «وتعرض من الأقرب إلى الأبعد» — newest first, and that replaces the old
   ordering by kind. A list sorted by category makes the reader ask which
   category a thing was filed under before he can find it; a list sorted by time
   answers the question he actually has, which is what happened since he last
   looked. Kind is the tiebreaker, so two alerts from the same day still come out
   in the order they are worth acting on. */
const ORDER: Alert['kind'][] =
  ['EXAM_DUE', 'BOOKED', 'ABSENCE', 'MESSAGE', 'RESULT', 'PLAN'];

export const sortAlerts = (list: Alert[]) => [...list].sort((a, b) => {
  const at = String(b.at ?? '').localeCompare(String(a.at ?? ''));
  return at !== 0 ? at : ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind);
});

export type TeacherMe = {
  who: { id: string; name: string; role: 'TEACHER' | 'SUPERVISOR' };
  halaqa: { id: string; name: string; teacher: string; timeSlot: string; mosque: string };
  today: string;
  /** Whether today is one of the days this halaqa's own days open by themselves.
      Not a gate: any day with تحضير on it is a halaqa day. */
  opensItself: boolean;
  weekdays: number[];
  state: 'NOT_STARTED' | 'PARTIAL' | 'COMPLETE';
  counts: {
    roster: number; saved: number; present: number; absent: number;
    recited: number; dueForExam: number;
  };
  alerts: Alert[];
  unread: number;
};

const Ctx = createContext<{
  me: TeacherMe | null;
  reload: () => void;
  /** Tick alerts off. Optimistic here and written on the server, so the dot goes
      out under the thumb and stays out on his other device. */
  markRead: (keys: string[]) => void;
}>({ me: null, reload: () => {}, markRead: () => {} });
export const useMe = () => useContext(Ctx);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<TeacherMe | null>(null);
  /* The read-marker lives HERE and not on a screen, because two things show the
     same alerts at once: the bell in the hero and the list on الرئيسية. Two
     local copies of «what I have already read» would disagree the moment one of
     them was tapped. */
  const [read, setRead] = useState<Set<string>>(new Set());
  const router = useRouter();

  const reload = useCallback(() => {
    fetch('/api/teacher/me')
      .then((r) => {
        if (r.status === 401) { router.replace('/teacher/login'); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => { if (d && !d.error) setMe(d); })
      .catch(() => { /* the screen shows its own error state */ });
  }, [router]);

  useEffect(() => { reload(); }, [reload]);

  const markRead = useCallback((keys: string[]) => {
    const fresh = keys.filter((k) => k && !read.has(k));
    if (!fresh.length) return;
    setRead((s) => new Set([...s, ...fresh]));
    fetch('/api/teacher/me', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: fresh }),
    }).then(() => reload()).catch(() => { /* the dot is back on the next load */ });
  }, [read, reload]);

  /* Sorted and merged once, so every reader sees one order and one set of
     ticks rather than each screen deciding for itself. */
  const value = useMemo(() => {
    if (!me) return { me: null, reload, markRead };
    const alerts = sortAlerts(me.alerts).map(
      (a) => (a.read || read.has(a.key) ? { ...a, read: true } : a));
    return {
      me: { ...me, alerts, unread: alerts.filter((a) => !a.read).length },
      reload,
      markRead,
    };
  }, [me, read, reload, markRead]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
