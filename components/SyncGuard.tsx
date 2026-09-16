'use client';
/* Hydrates the store from the server on arrival, and says so when a save is
   not landing. Silence about a failed save is the worst outcome: the
   supervisor keeps working against a copy nobody else will ever see. */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { CloudOff, KeyRound, Loader2, LogIn, X } from 'lucide-react';
import { Btn } from '@/components/ui';
import { store, hydrateFromServer, flushToServer, syncStatus, setActor } from '@/lib/store';
import { useMyName } from '@/lib/useMe';

export function SyncGuard() {
  const state = useSyncExternalStore(store.subscribe, syncStatus, () => 'idle' as const);

  /* A student added on any screen gets his account from the save itself. The
     login number is what goes on his card, so it is shown here — once, and
     wherever he was added — rather than left for the supervisor to hunt for
     in the settings. */
  const [fresh, setFresh] = useState<{ fullName: string; username: string }[]>([]);
  const [noId, setNoId] = useState<string[]>([]);
  useEffect(() => {
    if (state !== 'saved') return;
    const t = store.takeNewAccounts();
    if (t.issued.length) setFresh((c) => [...c, ...t.issued]);
    if (t.noNationalId.length) setNoId((c) => [...c, ...t.noNationalId]);
  }, [state]);

  /* Mounted on every admin screen, so this is where the store learns whose
     name goes on what he writes. */
  const myName = useMyName();
  useEffect(() => { setActor(myName); }, [myName]);

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

  if (fresh.length || noId.length) {
    return (
      <div role="status" className="fade fixed inset-x-0 bottom-6 z-[88] flex justify-center px-4">
        <div className="max-w-xl rounded-xl border border-brand-200 bg-paper px-5 py-4 shadow-pop">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
              <KeyRound size={17} />
            </span>
            <div className="min-w-0 flex-1">
              {fresh.length > 0 && (
                <>
                  <p className="text-base2 font-medium text-ink-900">
                    {fresh.length === 1 ? 'أُنشئ حساب الطالب' : `أُنشئت ${fresh.length} حسابات`}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {fresh.map((a) => (
                      <li key={a.username} className="flex items-baseline justify-between gap-4 text-panel">
                        <span className="truncate text-ink-800">{a.fullName}</span>
                        <span className="shrink-0 text-ink-600">
                          رقم الدخول <bdi dir="ltr" className="font-medium tabular-nums text-ink-900">{a.username}</bdi>
                          {' · '}كلمة المرور رقم هويته
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {noId.length > 0 && (
                <p className={`text-panel text-warn-700 ${fresh.length ? 'mt-3' : ''}`}>
                  ولا حساب لـ{noId.join('، ')} — لا رقم هوية، وهو كلمة المرور.
                </p>
              )}
            </div>
            <button onClick={() => { setFresh([]); setNoId([]); }}
              aria-label="إغلاق" className="shrink-0 rounded-md p-1 text-ink-500 hover:bg-ink-100">
              <X size={16} />
            </button>
          </div>
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
