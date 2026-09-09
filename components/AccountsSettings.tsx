'use client';
/* حسابات الطلاب — under الإعدادات, where the supervisor changes things rather
   than looks at them.

   A PIN cannot be read back. It is stored as a bcrypt hash, which is one-way
   by design, so «what is his PIN?» has no answer anywhere in this system — not
   for him, not for me. What the supervisor can do is SET one, and that is what
   this screen offers: a boy who forgot his is standing in front of you, and
   choosing one for him now beats handing him a random string to memorise. */
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
          meta="اسم الدخول والرمز — للتعديل، ولإخراج ملف يُسلَّم للمعلّمين" />

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
          الرمز يُخزَّن مشفَّرًا باتجاه واحد، فلا يمكن لأحد قراءته — ولا للنظام نفسه.
          مَن نسي رمزه، اكتب له رمزًا جديدًا من هنا.
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
                      : r.mustChangePin ? <Chip tone="ink">لم يغيّر رمزه</Chip>
                      : <Chip tone="ok">غيّر رمزه</Chip>}
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
            <span className="mb-1.5 block text-xs2 font-medium text-ink-700">اسم الدخول</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              dir="ltr" className={cx(INPUT, 'text-center')} />
            <span className="mt-1 block text-micro text-ink-500">
              رقم الهوية عادةً — وإذا تشارك طالبان رقمًا واحدًا، أضِف لأحدهما لاحقة.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs2 font-medium text-ink-700">رمز جديد</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric" dir="ltr" placeholder="—————"
              className={cx(INPUT, 'h-14 text-center font-display text-d2 tracking-[.5em]')} />
            <span className="mt-1 block text-micro text-ink-500">
              خمسة أرقام. اتركه فارغًا إن كنت تغيّر اسم الدخول وحده.
              وسيُطلب من الطالب تغييره في أول دخول، لأنك تعرفه الآن.
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
          <Btn variant="danger" icon={exporting ? undefined : Download}
            onClick={exportAll} disabled={exporting}>
            {exporting ? <><Loader2 size={16} className="animate-spin" /> جارٍ…</> : 'ولّد الملف'}
          </Btn>
        </>}>
        <div className="space-y-3">
          <p className="text-base2 text-ink-700">
            الرموز مخزَّنة مشفَّرة ولا تُقرأ، فالملف يُنتَج بأن <strong>يُعيّن رموزًا جديدة</strong> للجميع.
          </p>
          <p className="rounded-lg bg-warn-100 px-3.5 py-3 text-panel text-warn-700">
            كل رمز قديم يتوقّف فورًا. لا تفعلها إن كان الطلاب قد استلموا رموزهم ودخلوا بها.
          </p>
          <p className="text-panel text-ink-500">
            الملف يحوي: الحلقة · الطالب · اسم الدخول · الرمز · ملاحظة عند اشتراك الهوية.
            احفظه في مكان آمن — فيه رموز كل الطلاب بنص صريح.
          </p>
        </div>
      </Modal>
    </Sheet>
  );
}
