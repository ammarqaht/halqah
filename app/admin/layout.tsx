'use client';
import { Suspense, useEffect, useState } from 'react';
import { Rail } from '@/components/Rail';
import { RouteVeil } from '@/components/RouteVeil';
import { PanelContext } from '@/components/PanelContext';
import { PanelState } from '@/components/PanelState';

const panelSkeleton = <div className="flex-1 p-4"><div className="skel h-5 w-32" /></div>;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(true);

  /* The panel is mounted only after hydration, and this is load-bearing rather
     than cosmetic.

     Its content comes entirely from the browser store, so there is nothing
     truthful for the server to render — but the real problem is worse than a
     wasted render. The panel's per-section surfaces read `useSearchParams`,
     which makes Next mark this Suspense boundary as *postponed* while
     prerendering. On a route whose page also opts out of static rendering the
     boundary is resumed on the client and resolves; on `/admin`, which stays
     fully static, nothing ever resumed it and the panel sat on its skeleton
     forever after a hard load — the alerts screen with no alerts on it.

     Mounting on the client creates the boundary fresh in the browser, where it
     resolves immediately. Verified against a production build on `/admin`,
     `/admin/students`, `/admin/points` and `/admin/store`. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <PanelState.Provider value={{ panelOpen, setPanelOpen }}>
      <div className="flex h-screen overflow-hidden bg-page text-ink-900">
        {/* tier 1 — the spine, always present, never collapses */}
        <Rail />

        {/* tier 2 — contextual panel: collapsible, re-tools itself per section */}
        {panelOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-brand-900/25 md:hidden" onClick={() => setPanelOpen(false)} />
            <aside className="fade fixed inset-y-0 right-14 z-40 flex w-60 shrink-0 flex-col border-s border-ink-200 bg-paper md:static md:right-auto md:z-auto">
              {mounted ? (
                <Suspense fallback={panelSkeleton}>
                  <PanelContext onClose={() => setPanelOpen(false)} />
                </Suspense>
              ) : panelSkeleton}
            </aside>
          </>
        )}

        {/* tier 3 — work area */}
        <main className="thin-scroll flex-1 overflow-y-auto">
          <RouteVeil>{children}</RouteVeil>
        </main>
      </div>
    </PanelState.Provider>
  );
}
