'use client';
import { Suspense, useState } from 'react';
import { Rail } from '@/components/Rail';
import { RouteVeil } from '@/components/RouteVeil';
import { PanelContext } from '@/components/PanelContext';
import { PanelState } from '@/components/PanelState';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(true);

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
              <Suspense fallback={<div className="flex-1 p-4"><div className="skel h-5 w-32" /></div>}>
                <PanelContext onClose={() => setPanelOpen(false)} />
              </Suspense>
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
