'use client';
/* المشرفون — كلمة المرور، ومن يملك مفتاحًا.

   There is exactly one role in this system. Every supervisor sees the same
   students, the same points and the same reports, and a change one makes is
   the change the others open — because all of it lives in one database and
   none of it is scoped to whoever typed it. So this screen grants nothing and
   restricts nothing; it changes a password and says plainly who holds a key. */
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, Check, AlertTriangle } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, INPUT } from '@/components/ui';
import { formatDate } from '@/lib/dates';

type Supervisor = {
  id: string; fullName: string; username: string;
  active: boolean; lastLoginAt: string | null;
};

export function SupervisorSettingsCard() {
  const [me, setMe] = useState<string | null>(null);
  const [list, setList] = useState<Supervisor[] | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setMe(d.me); setList(d.supervisors ?? []); } })
      .catch(() => setList([]));
  }, []);
  useEffect(load, [load]);

  const mismatch = again.length > 0 && next !== again;
  const tooShort = next.length > 0 && next.length < 8;
  const ready = current.length > 0 && next.length >= 8 && next === again && !busy;

  const submit = async () => {
    setBusy(true); setErr(null); setDone(false);
    try {
      const res = await fetch('/api/admin/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d?.error ?? 'تعذّر التغيير.'); return; }
      setDone(true); setCurrent(''); setNext(''); setAgain('');
    } catch {
      setErr('تعذّر الوصول إلى الخادم.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <Sheet className="rise mb-4">
        <SheetHead title="كلمة مروري" meta="تُغيَّر من هنا، ولا يراها أحد — ولا نحن" />

        <div className="grid max-w-md gap-4">
          <label className="block">
            <span className="mb-1.5 block text-panel text-ink-600">كلمة المرور الحالية</span>
            <input type="password" autoComplete="current-password" className={INPUT}
              value={current} onChange={(e) => { setCurrent(e.target.value); setDone(false); }} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-panel text-ink-600">كلمة المرور الجديدة</span>
            <input type="password" autoComplete="new-password" className={INPUT}
              value={next} onChange={(e) => { setNext(e.target.value); setDone(false); }} />
            {tooShort && (
              <span className="mt-1 block text-cap text-warn-700">ثمانية أحرف فأكثر.</span>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-panel text-ink-600">أعدها مرة أخرى</span>
            <input type="password" autoComplete="new-password" className={INPUT}
              value={again} onChange={(e) => { setAgain(e.target.value); setDone(false); }} />
            {mismatch && (
              <span className="mt-1 block text-cap text-warn-700">لا تطابق الأولى.</span>
            )}
          </label>

          <div className="flex items-center gap-3">
            <Btn variant="primary" icon={busy ? Loader2 : KeyRound} disabled={!ready} onClick={submit}>
              {busy ? 'جارٍ التغيير…' : 'تغيير كلمة المرور'}
            </Btn>
            {done && (
              <span className="flex items-center gap-1.5 text-panel text-brand-700">
                <Check size={15} /> تم — استعملها في الدخول القادم.
              </span>
            )}
          </div>

          {err && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />{err}
            </p>
          )}
        </div>
      </Sheet>

      <Sheet className="rise" pad={false}>
        <div className="p-6 pb-4">
          <SheetHead title="المشرفون" meta="لهم جميعًا الصلاحيات نفسها، وعلى البيانات نفسها" />
        </div>

        {list === null ? (
          <div className="space-y-2 px-6 pb-6">
            {[0, 1].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-body">
              <thead>
                <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                  {['المشرف', 'اسم الدخول', 'الحالة', 'آخر دخول'].map((h) => (
                    <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="border-b border-ink-150 last:border-0">
                    <td className="px-3 py-3">
                      <span className="text-ink-900">{u.fullName}</span>
                      {u.id === me && <span className="ms-2"><Chip tone="brand">أنت</Chip></span>}
                    </td>
                    <td className="px-3 py-3">
                      <bdi dir="ltr" className="tabular-nums text-ink-700">{u.username}</bdi>
                    </td>
                    <td className="px-3 py-3">
                      {u.active
                        ? <span className="text-brand-700">مفعّل</span>
                        : <span className="text-ink-500">موقوف</span>}
                    </td>
                    <td className="px-3 py-3 text-ink-600">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-start gap-2.5 border-t border-ink-150 px-6 py-4">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-700" />
          <p className="text-panel text-ink-600">
            النظام واحد لهم جميعًا: الطلاب والحلقات والنقاط والاختبارات والتقارير كلها في قاعدة
            واحدة، فما يغيّره أحدكم يفتحه الآخر على تغييره. ولا فرق في الصلاحيات — ليس في النظام
            دور ثانٍ يُمنح أو يُمنع.
          </p>
        </div>
      </Sheet>
    </>
  );
}
