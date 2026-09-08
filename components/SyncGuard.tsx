'use client';
/* Hydrates the store from the server on arrival, and says so when a save is
   not landing. Silence about a failed save is the worst outcome: the
   supervisor keeps working against a copy nobody else will ever see. */
import { useEffect, useSyncExternalStore } from 'react';
import { CloudOff, Loader2, LogIn } from 'lucide-react';
import { Btn } from '@/components/ui';
import { store, hydrateFromServer, flushToServer, syncStatus } from '@/lib/store';

export function SyncGuard() {
  const state = useSyncExternalStore(store.subscribe, syncStatus, () => 'idle' as const);

  useEffect(() => {
    void hydrateFromServer();
    /* Closing the tab mid-edit must not lose the last nine hundred
       milliseconds of work. */
    const flush = () => { void flushToServer(); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  if (state === 'unauthorized') {
    return (
      <div role="alert"
        className="fade fixed inset-x-0 bottom-6 z-[88] flex justify-center px-4">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-risk-200 bg-paper px-5 py-4 shadow-pop">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-risk-100 text-risk-700">
            <LogIn size={17} />
          </span>
          <p className="text-base2 text-ink-800">
            انتهت الجلسة، فلم يصل الحفظ إلى الخادم. عملك محفوظ هنا — سجّل الدخول ليُرسَل.
          </p>
          <a href={`/login?reason=expired&next=${encodeURIComponent(location.pathname)}`}>
            <Btn variant="primary">تسجيل الدخول</Btn>
          </a>
        </div>
      </div>
    );
  }

  if (state !== 'offline' && state !== 'saving') return null;

  return (
    <div role="status"
      className="fade pointer-events-none fixed bottom-6 end-6 z-[85] flex items-center gap-2 rounded-lg border border-ink-200 bg-paper px-3.5 py-2 text-panel shadow-soft">
      {state === 'saving' ? (
        <><Loader2 size={15} className="animate-spin text-brand-700" />
          <span className="text-ink-600">جارٍ الحفظ…</span></>
      ) : (
        <><CloudOff size={15} className="text-warn-700" />
          <span className="text-warn-700">تعذّر الحفظ على الخادم — التغييرات محفوظة هنا وستُرسل عند عودة الاتصال.</span></>
      )}
    </div>
  );
}
