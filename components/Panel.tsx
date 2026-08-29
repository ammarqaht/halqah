'use client';
/* Tier 2 — the contextual panel. Not a submenu: it re-tools itself per section
   so the supervisor filters without leaving the results (DESIGN.md §4). */
import { PanelRightClose } from 'lucide-react';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';

export function PanelShell({ title, meta, onClose, children }:
  { title: string; meta?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-ink-150 px-3.5 py-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-body font-bold text-ink-900">{title}</h2>
          {meta && <p className="mt-0.5 truncate text-micro text-ink-500">{meta}</p>}
        </div>
        <button onClick={onClose} title="إخفاء اللوحة" aria-label="إخفاء اللوحة"
          className="shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800">
          <PanelRightClose size={17} strokeWidth={1.9} />
        </button>
      </header>
      <div className="thin-scroll flex-1 overflow-y-auto px-3 py-3.5 text-panel">{children}</div>
    </>
  );
}

export function PanelGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-1">
      {label && (
        <h3 className="mb-2 px-1.5 text-2xs font-medium uppercase tracking-[.12em] text-ink-500">{label}</h3>
      )}
      {children}
    </div>
  );
}

export function PanelItem({ children, sub, count, tone, active, onClick }:
  { children: React.ReactNode; sub?: string; count?: number;
    tone?: 'risk' | 'warn' | 'info' | 'ok'; active?: boolean; onClick?: () => void }) {
  const dot = tone && {
    risk: 'bg-risk-500', warn: 'bg-warn-500', info: 'bg-info-500', ok: 'bg-ok-500',
  }[tone];
  return (
    <button onClick={onClick}
      className={cx('mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-right',
        'transition-colors duration-150',
        active ? 'bg-brand-100 text-brand-800' : 'text-ink-700 hover:bg-ink-100')}>
      {dot && <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />}
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-panel', active && 'font-medium')}>{children}</span>
        {sub && <span className="mt-0.5 block truncate text-micro text-ink-500">{sub}</span>}
      </span>
      {count != null && (
        <span className={cx('shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium',
          active ? 'bg-brand-200 text-brand-900' : 'bg-ink-100 text-ink-600')}>
          <Num>{count}</Num>
        </span>
      )}
    </button>
  );
}
