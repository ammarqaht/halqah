'use client';
/* The band across a portal opened with حساب المطوّر (see lib/dev).
   It says that nothing here is kept, and it is the switch: any halaqa on the
   teacher's portal, any boy on the student's. Sticky, so it is never scrolled
   out of sight while buttons that look like they work are being pressed. */
import { useEffect, useMemo, useState } from 'react';
import { Code2, LogOut } from 'lucide-react';
import { halaqaLabel, shortName } from '@/lib/normalise';

type Halaqa = { id: string; name: string; teacher: string };
type Student = { id: string; fullName: string; halaqaId: string | null };
type List = { current: string | null; halaqat: Halaqa[]; students?: Student[] };

const SELECT = 'h-8 min-w-0 max-w-[16rem] flex-1 rounded-md border border-warn-200 bg-paper px-2 text-panel text-ink-900';

export function DevBand({ portal }: { portal: 'teacher' | 'student' }) {
  const [list, setList] = useState<List | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/${portal}/auth/dev`).then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setList(d)).catch(() => {});
  }, [portal]);

  /* Boys grouped under their halaqa, the way the supervisor reads them. */
  const groups = useMemo(() => (list?.halaqat ?? []).map((h) => ({
    h, boys: (list?.students ?? []).filter((s) => s.halaqaId === h.id),
  })).filter((g) => portal === 'teacher' || g.boys.length > 0), [list, portal]);

  const switchTo = async (id: string) => {
    setBusy(true); setErr('');
    const r = await fetch(`/api/${portal}/auth/dev`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(portal === 'teacher' ? { halaqaId: id } : { studentId: id }),
    }).catch(() => null);
    if (!r?.ok) { setErr('تعذّر التبديل.'); setBusy(false); return; }
    /* A full load: every screen's data belongs to the halaqa or boy it opened on. */
    window.location.href = `/${portal}`;
  };

  const end = async () => {
    setBusy(true);
    await fetch(`/api/${portal}/auth`, { method: 'DELETE' }).catch(() => null);
    window.location.href = `/${portal}/login`;
  };

  return (
    <div className="sticky top-0 z-50 border-b border-warn-200 bg-warn-100 text-warn-700">
      <div className="mx-auto flex max-w-column flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2 text-panel md:px-6">
        <Code2 size={16} className="shrink-0" />
        <span className="font-medium">حساب المطوّر</span>
        <span className="hidden text-warn-700/80 sm:inline">— للقراءة، ولا يُحفظ شيء</span>

        {list && (
          <select className={SELECT} disabled={busy} value={list.current ?? ''}
            aria-label={portal === 'teacher' ? 'الحلقة' : 'الطالب'}
            onChange={(e) => switchTo(e.target.value)}>
            {portal === 'teacher'
              ? groups.map(({ h }) => (
                  <option key={h.id} value={h.id}>{halaqaLabel(shortName(h.teacher || h.name))}</option>))
              : groups.map(({ h, boys }) => (
                  <optgroup key={h.id} label={halaqaLabel(shortName(h.teacher || h.name))}>
                    {boys.map((b) => <option key={b.id} value={b.id}>{b.fullName}</option>)}
                  </optgroup>))}
          </select>
        )}
        {err && <span role="alert">{err}</span>}

        <button onClick={end} disabled={busy}
          className="ms-auto flex shrink-0 items-center gap-1.5 rounded-md border border-warn-200 bg-paper px-2.5 py-1 font-medium transition-colors hover:bg-warn-100 disabled:opacity-55">
          <LogOut size={14} />
          خروج
        </button>
      </div>
    </div>
  );
}
