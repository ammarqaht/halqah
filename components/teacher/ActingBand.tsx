'use client';
/* The band across the teacher's portal when a SUPERVISOR is standing in for an
   absent teacher (26 Oct 2026). It says whose name what he saves goes under,
   and it is the switch to any halaqa. In the flow above the nav, not stuck to
   the top: stuck, it covered the nav — and the nav already names the halaqa
   he is writing to. */
import { useEffect, useState } from 'react';
import { LogOut, UserCheck } from 'lucide-react';
import { halaqaLabel, shortName } from '@/lib/normalise';

type Halaqa = { id: string; name: string; teacher: string };

export function ActingBand() {
  const [list, setList] = useState<{ current: string | null; halaqat: Halaqa[]; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/teacher/auth/acting').then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setList(d)).catch(() => {});
  }, []);

  const switchTo = async (id: string) => {
    setBusy(true); setErr('');
    const r = await fetch('/api/teacher/auth/acting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ halaqaId: id }),
    }).catch(() => null);
    if (!r?.ok) { setErr('تعذّر التبديل.'); setBusy(false); return; }
    /* A full load: every screen's data belongs to the halaqa it opened on. */
    window.location.href = '/teacher';
  };

  const end = async () => {
    setBusy(true);
    await fetch('/api/teacher/auth', { method: 'DELETE' }).catch(() => null);
    window.location.href = '/teacher/login';
  };

  return (
    <div className="relative z-50 border-b border-brand-200 bg-brand-50 text-brand-800">
      <div className="mx-auto flex max-w-column flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2 text-panel md:px-6">
        <UserCheck size={16} className="shrink-0" />
        <span className="font-medium">المشرف نائبًا</span>
        <span className="hidden text-brand-800/80 sm:inline">
          — ما تحفظه يُسجَّل باسمك{list?.name ? ` (${list.name})` : ''}
        </span>

        {list && (
          <select disabled={busy} value={list.current ?? ''} aria-label="الحلقة"
            onChange={(e) => switchTo(e.target.value)}
            className="h-11 min-w-0 max-w-[16rem] flex-1 rounded-md border border-brand-200 bg-paper px-2 text-panel text-ink-900">
            {list.halaqat.map((h) => (
              <option key={h.id} value={h.id}>{halaqaLabel(shortName(h.teacher || h.name))}</option>))}
          </select>
        )}
        {err && <span role="alert" className="text-risk-700">{err}</span>}

        <button onClick={end} disabled={busy}
          className="ms-auto flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-brand-200 bg-paper px-3 font-medium transition-colors hover:bg-brand-100 disabled:opacity-55">
          <LogOut size={14} />
          خروج
        </button>
      </div>
    </div>
  );
}
