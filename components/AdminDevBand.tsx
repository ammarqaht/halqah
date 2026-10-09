'use client';
/* The band across the supervisor's portal opened with حساب المطوّر (3999,
   lib/dev). Every screen opens and every button can be pressed; nothing is
   kept — the middleware refuses the writes, and the store stops trying to
   send them (setPreviewMode). Sticky, so it is never scrolled out of sight. */
import { useEffect, useState } from 'react';
import { Code2, LogOut } from 'lucide-react';
import { setPreviewMode } from '@/lib/store';

export function AdminDevBand() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    fetch('/api/admin/me').then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.preview) { setPreviewMode(true); setOn(true); } })
      .catch(() => {});
  }, []);

  if (!on) return null;
  return (
    <div className="sticky top-0 z-[60] flex items-center gap-3 border-b border-warn-200 bg-warn-100 px-4 py-2 text-panel text-warn-700">
      <Code2 size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <b className="font-medium">حساب المطوّر — وضع المعاينة.</b>{' '}
        كل الشاشات مفتوحة للقراءة، وما يُعدَّل هنا لا يُحفظ.
      </span>
      <button type="button"
        onClick={() => fetch('/api/auth/logout', { method: 'POST' }).finally(() => { window.location.href = '/login'; })}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-warn-200 bg-paper px-2.5 py-1 text-panel text-ink-700 hover:bg-page">
        <LogOut size={14} /> خروج
      </button>
    </div>
  );
}
