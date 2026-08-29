'use client';
import { PanelRightOpen, Search } from 'lucide-react';
import { cx } from '@/lib/cx';

export function TopBar({ title, crumbs, panelOpen, onOpenPanel, action }:
  { title: string; crumbs?: string[]; panelOpen: boolean; onOpenPanel: () => void; action?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-ink-150 bg-page/85 px-5 backdrop-blur-md">
      {!panelOpen && (
        <button onClick={onOpenPanel} title="إظهار اللوحة" aria-label="إظهار اللوحة"
          className="-ms-1 rounded p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900">
          <PanelRightOpen size={18} strokeWidth={1.9} />
        </button>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-h3 font-bold text-ink-900">{title}</h1>
        {crumbs?.length ? (
          <p className="truncate text-micro text-ink-500">{crumbs.join(' ← ')}</p>
        ) : null}
      </div>
      <div className="ms-auto flex items-center gap-2">
        <button aria-label="بحث"
          className="hidden h-9 items-center gap-2 rounded-md border border-ink-200 bg-paper px-3 text-cap text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-700 sm:flex">
          <Search size={15} strokeWidth={1.9} />
          بحث سريع
          <kbd className="rounded border border-ink-200 bg-ink-100 px-1 text-2xs text-ink-500">⌘K</kbd>
        </button>
        {action}
      </div>
    </header>
  );
}
