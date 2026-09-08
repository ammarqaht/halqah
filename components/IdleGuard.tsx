'use client';
/* The idle timeout, in the browser.
   The SERVER is what actually ends the session — the token lasts five minutes
   and this asks for five more while the supervisor is working. All this does
   is two courtesies the server cannot do: warn him before it happens, so he
   does not lose a half-typed exam, and take him to the login screen the moment
   it does rather than on his next click into a wall.

   Activity is shared across tabs through localStorage: reading a report in one
   tab must not sign him out of the one he is typing in. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Clock } from 'lucide-react';
import { Btn } from '@/components/ui';
import { Num } from '@/components/Num';

const KEY = 'halqah_last_activity';
/** Kept a little under the server's five so the warning always precedes it. */
const IDLE_MS = 30 * 60 * 1000;
const WARN_MS = 45 * 1000;
/** The cookie is only re-issued this often, however busy he is. */
const TOUCH_EVERY = 60 * 1000;

const now = () => Date.now();
const readLast = () => {
  try { return Number(localStorage.getItem(KEY)) || now(); } catch { return now(); }
};

export function IdleGuard() {
  const router = useRouter();
  const lastTouch = useRef(0);
  const [left, setLeft] = useState<number | null>(null);
  const done = useRef(false);

  const mark = useCallback(() => {
    const t = now();
    try { localStorage.setItem(KEY, String(t)); } catch { /* private mode */ }
    setLeft(null);
    /* Re-issue at most once a minute: every click asking the server for a new
       cookie would be a request per click for no extra safety. */
    if (t - lastTouch.current > TOUCH_EVERY) {
      lastTouch.current = t;
      fetch('/api/auth/touch', { method: 'POST' }).catch(() => { /* offline — the tick still runs */ });
    }
  }, []);

  const signOut = useCallback(async () => {
    if (done.current) return;
    done.current = true;
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    router.replace('/login?reason=idle');
  }, [router]);

  useEffect(() => {
    mark();
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'] as const;
    for (const e of events) window.addEventListener(e, mark, { passive: true });

    /* Coming back to a tab that slept is exactly when the session may already
       be gone, so check immediately rather than on the next tick. */
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);

    const tick = () => {
      const idle = now() - readLast();
      if (idle >= IDLE_MS) { setLeft(0); void signOut(); return; }
      setLeft(idle >= IDLE_MS - WARN_MS ? Math.ceil((IDLE_MS - idle) / 1000) : null);
    };
    const id = setInterval(tick, 1000);

    return () => {
      for (const e of events) window.removeEventListener(e, mark);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(id);
    };
  }, [mark, signOut]);

  if (left === null) return null;

  return (
    <div role="alertdialog" aria-live="assertive"
      className="fade fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-warn-200 bg-paper px-5 py-4 shadow-pop">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warn-100 text-warn-700">
          <Clock size={17} />
        </span>
        <p className="text-base2 text-ink-800">
          ستُقفل الجلسة بعد <Num className="font-medium text-warn-700">{left}</Num> ثانية لعدم النشاط.
        </p>
        <div className="flex items-center gap-2">
          <Btn variant="primary" onClick={mark}>ابقَ متصلًا</Btn>
          <Btn icon={LogOut} onClick={() => void signOut()}>اخرج الآن</Btn>
        </div>
      </div>
    </div>
  );
}
