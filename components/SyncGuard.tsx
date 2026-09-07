'use client';
/* Hydrates the store from the server on arrival, and says so when a save is
   not landing. Silence about a failed save is the worst outcome: the
   supervisor keeps working against a copy nobody else will ever see. */
import { useEffect, useSyncExternalStore } from 'react';
import { CloudOff, Loader2 } from 'lucide-react';
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
