'use client';
/* حسابات الطلاب — under الإعدادات, where the supervisor changes things rather
   than looks at them.

   Sign-in is a four-digit login number and the boy's own national id, so there
   is nothing to generate, nothing to memorise and nothing to reset. This screen
   exists for the two cases that scheme does not cover: a roster id that was
   wrong and has been corrected, and a login number the supervisor wants moved. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Loader2, Search, Check, X, FileSpreadsheet, AlertTriangle, Download,
} from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty, Modal, INPUT } from '@/components/ui';
import { Num } from '@/components/Num';
import { foldArabic, halaqaLabel, shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Row = {
  studentId: string; fullName: string; halaqa: string | null;
  nationalId: string | null; username: string | null; hasAccount: boolean;
  mustChangePin: boolean | null; lastLoginAt: string | null;
  noNationalId: boolean; sharedNationalId: boolean;
};

export function AccountsSettingsCard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmExport, setConfirmExport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/credentials').then((r) => (r.ok ? r.json() : null))
      .then((d) => setRows(d?.rows ?? [])).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const n = foldArabic(q);
    return (rows ?? []).filter((r) => !n
      || foldArabic(r.fullName).includes(n)
      || (r.username ?? '').includes(q.trim()));
  }, [rows, q]);

  const open = (r: Row) => {
    setEditing(r); setUsername(r.username ?? r.nationalId ?? ''); setPin(''); setErr('');
  };

  const save = async () => {
    if (!editing || busy) return;
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/credentials/one', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: editing.studentId, username, pin: pin || undefined }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) { setErr(d?.error ?? 'تعذّر الحفظ.'); return; }
    setEditing(null); load();
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/credentials/export', { method: 'POST' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'حسابات-الطلاب.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      load();
    } catch { setErr('تعذّر إنشاء الملف.'); }
    setExporting(false);
    setConfirmExport(false);
  };

  const withAccount = (rows ?? []).filter((r) => r.hasAccount).length;

  return (
    <Sheet className="rise mb-4" pad={false}>
      <div className="p-6 pb-0">
        <SheetHead title="حسابات الطلاب"
          meta="رقم الدخول وكلمة المرور — للتعديل، ولإخراج ملف يُسلَّم للمعلّمين" />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <Search size={16} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهوية…" className={cx(INPUT, 'pe-10')} />
          </div>
          <Btn icon={FileSpreadsheet} onClick={() => setConfirmExport(true)}>
            ملف الحسابات (Excel)
          </Btn>
          <span className="text-panel text-ink-500">
            <Num className="font-medium text-ink-900">{withAccount}</Num> حسابًا
          </span>
        </div>

        <p className="mb-4 flex items-start gap-2.5 rounded-lg bg-info-100 px-3.5 py-3 text-panel text-info-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          يدخل الطالب برقم دخوله (أربعة أرقام) وكلمة المرور رقم هويته. لا شيء يُحفَظ ولا
          شيء يُنسى — ومَن نسي رقم دخوله يجده في ملف الحسابات.
        </p>
      </div>

      {rows === null ? (
        <div className="space-y-2 px-6 pb-6">
          {[0, 1, 2].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="px-6 pb-6"><Empty icon={KeyRound} title="لا نتائج" body="جرّب اسمًا آخر." /></div>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto border-t border-ink-150">
          <table className="w-full border-collapse text-body">
            <tbody>
              {shown.map((r) => (
                <tr key={r.studentId} className="border-b border-ink-150 last:border-0 hover:bg-page/60">
                  <td className="px-4 py-2.5 text-ink-900">
                    {r.fullName}
                    {r.halaqa && (
                      <span className="mt-0.5 block text-micro text-ink-500">
                        {halaqaLabel(shortName(r.halaqa))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.username
                      ? <Num className="text-panel text-ink-700">{r.username}</Num>
                      : <span className="text-panel text-ink-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.noNationalId ? <Chip tone="risk">بلا رقم هوية</Chip>
                      : !r.hasAccount ? <Chip tone="warn">بلا حساب</Chip>
                      : <Chip tone="ok">جاهز</Chip>}
                    {r.sharedNationalId && <Chip tone="warn">هوية مشتركة</Chip>}
                  </td>
                  <td className="px-3 py-2.5 text-panel text-ink-500">
                    {r.lastLoginAt ? <Num>{formatDate(r.lastLoginAt.slice(0, 10))}</Num> : 'لم يدخل بعد'}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <Btn size="sm" onClick={() => open(r)}>تعديل</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => !busy && setEditing(null)}
        title={editing ? `حساب ${editing.fullName}` : ''}
        footer={<>
          <Btn onClick={() => setEditing(null)} disabled={busy}>إلغاء</Btn>
          <Btn variant="primary" onClick={save} disabled={busy || (!username.trim() && !pin)}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> جارٍ…</> : 'احفظ'}
          </Btn>
        </>}>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs2 font-medium text-ink-700">رقم الدخول</span>
            <input value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\D/g, '').slice(0, 4))}
              dir="ltr" inputMode="numeric" className={cx(INPUT, 'h-14 text-center text-lg2 tracking-[.3em]')} />
            <span className="mt-1 block text-micro text-ink-500">
              أربعة أرقام، من ١٠٠١ فأعلى. لا يتكرّر بين طالبين.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs2 font-medium text-ink-700">كلمة المرور</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              inputMode="numeric" dir="ltr" placeholder="رقم الهوية"
              className={cx(INPUT, 'h-14 text-center text-lg2 tracking-[.10em]')} />
            <span className="mt-1 block text-micro text-ink-500">
              رقم هويته. اتركه فارغًا إن كنت تغيّر رقم الدخول وحده.
            </span>
          </label>

          {err && (
            <p role="alert" className="rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
              {err}
            </p>
          )}
        </div>
      </Modal>

      {/* The file can only be produced by SETTING the PINs — so say so first. */}
      <Modal open={confirmExport} onClose={() => !exporting && setConfirmExport(false)}
        title="ملف حسابات الطلاب"
        footer={<>
          <Btn onClick={() => setConfirmExport(false)} disabled={exporting}>تراجع</Btn>
          <Btn variant="primary" icon={exporting ? undefined : Download}
            onClick={exportAll} disabled={exporting}>
            {exporting ? <><Loader2 size={16} className="animate-spin" /> جارٍ…</> : 'ولّد الملف'}
          </Btn>
        </>}>
        <div className="space-y-3">
          <p className="text-base2 text-ink-700">
            الملف يحوي: الحلقة · الطالب · رقم الدخول · كلمة المرور.
          </p>
          <p className="rounded-lg bg-info-100 px-3.5 py-3 text-panel text-info-700">
            لا شيء يتغيّر بإنشائه — أرقام الدخول هي المحفوظة، وكلمة المرور رقم الهوية.
            يمكنك إخراجه متى شئت، ونسخه القديمة تبقى صالحة.
          </p>
          <p className="text-panel text-ink-500">
            ومع ذلك فيه أسماء الطلاب وأرقام هوياتهم — احفظه في مكان آمن.
          </p>
        </div>
      </Modal>
    </Sheet>
  );
}
