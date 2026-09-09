'use client';
/* حسابات الطلاب — the PINs the supervisor prints and hands to the teachers.
   The plaintext is shown ONCE, here, at the moment it is generated. After that
   only a reset can produce another, and a reset writes an audit row. */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  KeyRound, Loader2, Printer, RotateCcw, AlertTriangle, CheckCircle2, Users2,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty, Modal } from '@/components/ui';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { useDB } from '@/lib/store';
import { halaqaLabel, shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';

type Row = {
  studentId: string; fullName: string; halaqa: string | null; halaqaId: string | null;
  nationalId: string | null; username: string | null; hasAccount: boolean;
  mustChangePin: boolean | null; lastLoginAt: string | null;
  noNationalId: boolean; sharedNationalId: boolean;
};
type Issued = { studentId: string; fullName: string; username: string; pin: string };

export default function Accounts() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Issued[] | null>(null);
  const [err, setErr] = useState('');
  const [resetting, setResetting] = useState<Row | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/credentials').then((r) => (r.ok ? r.json() : null))
      .then((d) => setRows(d?.rows ?? [])).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const run = async (studentId?: string) => {
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentId ? { studentId } : {}),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setBusy(false); setResetting(null);
    if (!res?.ok) { setErr(d?.error ?? 'تعذّر إنشاء الحسابات.'); return; }
    setIssued(d.issued ?? []);
    load();
  };

  const withAccount = (rows ?? []).filter((r) => r.hasAccount).length;
  const missing = (rows ?? []).filter((r) => !r.hasAccount && !r.noNationalId).length;
  const noId = (rows ?? []).filter((r) => r.noNationalId).length;
  const shared = (rows ?? []).filter((r) => r.sharedNationalId).length;

  return (
    <>
      <TopBar title="حسابات الطلاب" crumbs={['الطلاب والحلقات']}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={
          <Btn variant="primary" icon={busy ? undefined : KeyRound} disabled={busy || missing === 0}
            onClick={() => run()}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> جارٍ…</>
              : <>إنشاء الحسابات الناقصة{missing > 0 && <> (<Num>{missing}</Num>)</>}</>}
          </Btn>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <Sheet className="rise mb-4">
          <SheetHead title="ما يحتاجه الطلاب للدخول"
            meta="اسم الدخول رقم الهوية، والرمز خمسة أرقام تُطبع وتُسلَّم للمعلّم" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              ['لهم حساب', withAccount, 'ok'],
              ['بلا حساب', missing, missing ? 'warn' : 'ink'],
              ['بلا رقم هوية', noId, noId ? 'risk' : 'ink'],
              ['هوية مشتركة', shared, shared ? 'warn' : 'ink'],
            ] as const).map(([label, n, tone]) => (
              <div key={label}>
                <p className="text-micro text-ink-500">{label}</p>
                <p className="mt-0.5 font-display text-t1 text-ink-900"><Num>{n}</Num></p>
                {n > 0 && tone !== 'ink' && <Chip tone={tone}>يحتاج نظرك</Chip>}
              </div>
            ))}
          </div>
          {err && (
            <p role="alert" className="mt-4 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
              {err}
            </p>
          )}
        </Sheet>

        {/* one sheet per halaqa — that is how they are handed out */}
        <Sheet className="rise mb-4">
          <SheetHead title="أوراق الحلقات" meta="ورقة لكل حلقة، تُقصّ قسائم ويُعطى كل طالب قسيمته" />
          <div className="flex flex-wrap gap-2">
            {db.halaqat.map((h) => (
              <a key={h.id} href={`/print/credentials/${h.id}`} target="_blank" rel="noreferrer">
                <Btn icon={Printer}>{halaqaLabel(shortName(h.teacher))}</Btn>
              </a>
            ))}
            {db.halaqat.length === 0 && <p className="text-panel text-ink-500">ارفع ملفاتك أولًا.</p>}
          </div>
        </Sheet>

        <Sheet className="rise" pad={false}>
          {rows === null ? (
            <div className="space-y-2 p-6">{[0, 1, 2].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}</div>
          ) : rows.length === 0 ? (
            <Empty icon={Users2} title="لا طلاب" body="ارفع ملفاتك من الصفحة الرئيسية أولًا." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-body">
                <thead>
                  <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                    {['الطالب', 'الحلقة', 'اسم الدخول', 'الحالة', 'آخر دخول', ''].map((h, i) => (
                      <th key={i} className="px-3 py-3 text-start font-medium">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.studentId} className="border-b border-ink-150 last:border-0">
                      <td className="px-3 py-3 text-ink-900">{r.fullName}</td>
                      <td className="px-3 py-3 text-panel text-ink-600">
                        {r.halaqa ? halaqaLabel(shortName(r.halaqa)) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        {r.username
                          ? <Num className="text-panel text-ink-700">{r.username}</Num>
                          : <span className="text-ink-400">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {r.noNationalId ? <Chip tone="risk">بلا رقم هوية — يحتاج تعيين</Chip>
                          : !r.hasAccount ? <Chip tone="warn">بلا حساب</Chip>
                          : r.mustChangePin ? <Chip tone="ink">الرمز المطبوع</Chip>
                          : <Chip tone="ok">غيّر رمزه</Chip>}
                        {r.sharedNationalId && <Chip tone="warn">هوية مشتركة</Chip>}
                      </td>
                      <td className="px-3 py-3 text-panel text-ink-600">
                        {r.lastLoginAt ? <Num>{formatDate(r.lastLoginAt.slice(0, 10))}</Num> : '—'}
                      </td>
                      <td className="px-2 py-3 text-end">
                        {r.hasAccount && (
                          <button onClick={() => setResetting(r)} title="إعادة تعيين الرمز"
                            aria-label={`إعادة تعيين رمز ${r.fullName}`}
                            className="rounded p-1.5 text-ink-400 transition-colors hover:bg-warn-100 hover:text-warn-700">
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Sheet>
      </div>

      {/* The one moment the plaintext exists. */}
      <Modal open={issued !== null} onClose={() => setIssued(null)}
        title={`الرموز الجديدة (${issued?.length ?? 0})`}
        footer={<Btn variant="primary" onClick={() => setIssued(null)}>أغلق</Btn>}>
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg bg-warn-100 px-3.5 py-3 text-panel text-warn-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            تُعرض مرة واحدة فقط. اطبع أوراق الحلقات الآن، أو أعد التعيين لاحقًا لطالب بعينه.
          </p>
          <ul className="max-h-[46vh] divide-y divide-ink-150 overflow-y-auto rounded-lg border border-ink-150">
            {(issued ?? []).map((i) => (
              <li key={i.studentId} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-panel text-ink-900">{i.fullName}</span>
                <Num className="text-panel text-ink-500">{i.username}</Num>
                <Num className="font-display text-lg2 tracking-[.14em] text-brand-800">{i.pin}</Num>
              </li>
            ))}
            {issued?.length === 0 && (
              <li className="px-3 py-4 text-center text-panel text-ink-500">
                <CheckCircle2 size={16} className="mx-auto mb-1 text-ok-700" />
                كل الطلاب لهم حسابات — لم يتغيّر شيء.
              </li>
            )}
          </ul>
        </div>
      </Modal>

      <Modal open={resetting !== null} onClose={() => !busy && setResetting(null)}
        title="إعادة تعيين الرمز"
        footer={<>
          <Btn onClick={() => setResetting(null)} disabled={busy}>تراجع</Btn>
          <Btn variant="danger" disabled={busy} onClick={() => resetting && run(resetting.studentId)}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> جارٍ…</> : 'أعد التعيين'}
          </Btn>
        </>}>
        {resetting && (
          <p className="text-base2 text-ink-700">
            سيُعطى <span className="font-medium">{resetting.fullName}</span> رمزًا جديدًا،
            ويتوقّف رمزه الحالي عن العمل فورًا. يُعرض الرمز مرة واحدة.
          </p>
        )}
      </Modal>
    </>
  );
}
