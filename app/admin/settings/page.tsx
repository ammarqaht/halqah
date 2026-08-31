'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Trash2, AlertTriangle, FlaskConical, Loader2, CheckCircle2, WifiOff } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Modal } from '@/components/ui';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { derive } from '@/lib/derive';

type Stats = { students: number; halaqat: number; imports: number; audit: number; bytes: number };

const humanBytes = (b: number) => {
  if (!b) return '—';
  const u = ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
  let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

export default function SettingsPage() {
  const { panelOpen, setPanelOpen } = usePanel();
  const local = derive(useDB());
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [dbDown, setDbDown] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ms: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/stats');
      if (!r.ok) { setDbDown(true); setStats(null); return; }
      setStats(await r.json()); setDbDown(false);
    } catch { setDbDown(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const reset = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/reset', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      store.reset();                       // the browser copy goes too
      setConfirm(false);
      setDone({ ms: d.ms ?? 0 });
      await load();
      router.refresh();
    } finally { setBusy(false); }
  };

  const totalRows = (stats?.students ?? 0) + (stats?.halaqat ?? 0)
    + (stats?.imports ?? 0) + (stats?.audit ?? 0);

  return (
    <>
      <TopBar title="الإعدادات" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <header className="rise mb-8">
          <h2 className="font-display text-d1 text-ink-900">الإعدادات</h2>
        </header>

        <Sheet className="rise mb-4">
          <SheetHead title="قاعدة البيانات"
            meta={dbDown ? 'غير متصلة' : stats ? `الحجم على القرص: ${humanBytes(stats.bytes)}` : 'جارٍ القراءة…'} />
          {dbDown ? (
            <div className="flex items-start gap-3 rounded-xl border border-warn-200 bg-warn-100/50 p-4">
              <WifiOff size={17} className="mt-0.5 shrink-0 text-warn-700" />
              <p className="text-panel text-ink-700">
                لم نصل إلى قاعدة البيانات. البيانات المعروضة في النظام محفوظة في متصفّحك وحده حاليًا.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { l: 'الطلاب', v: stats?.students },
                { l: 'الحلقات', v: stats?.halaqat },
                { l: 'عمليات الرفع', v: stats?.imports },
                { l: 'سجلّ التدقيق', v: stats?.audit },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-ink-150 bg-page/40 p-4">
                  <p className="text-xs2 text-ink-600">{k.l}</p>
                  <p className="mt-1.5 font-display text-d2 text-ink-900">
                    {k.v === undefined ? <span className="skel inline-block h-7 w-10 align-middle" /> : <Num>{k.v}</Num>}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 flex items-start gap-2 text-panel text-ink-500">
            <Database size={15} className="mt-0.5 shrink-0" />
            في متصفّحك الآن: <Num className="font-medium text-ink-700">{local.students}</Num> طالبًا
            و<Num className="font-medium text-ink-700">{local.halaqat}</Num> حلقات.
            نقل البيانات إلى القاعدة هو الخطوة القادمة في خطة البناء.
          </p>
        </Sheet>

        <Sheet className="rise border-warn-200">
          <SheetHead title="أدوات التجربة"
            meta="مرحلة التجريب — تختفي هذه الأدوات قبل التسليم" />

          {done && (
            <div className="fade mb-4 flex items-center gap-3 rounded-xl border border-ok-200 bg-ok-100 p-4">
              <CheckCircle2 size={18} className="shrink-0 text-ok-700" />
              <p className="text-panel text-ok-700">
                تم التصفير في <Num className="font-medium">{done.ms}</Num> مللي ثانية. القاعدة والمتصفّح فارغان.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-warn-100/60 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-body font-medium text-ink-900">
                <FlaskConical size={16} className="text-warn-700" />
                تصفير البيانات
              </p>
              <p className="mt-1 max-w-[40rem] text-panel text-ink-600">
                يمسح الطلاب والحلقات وعمليات الرفع وسجلّ التدقيق — من قاعدة البيانات ومن المتصفّح معًا،
                ويحرّر المساحة فورًا. <strong>لا يمسّ حسابك ولا الإعدادات المعتمدة.</strong>
              </p>
            </div>
            <Btn icon={Trash2} className="text-risk-700"
              disabled={busy || (totalRows === 0 && local.students === 0)}
              onClick={() => setConfirm(true)}>
              تصفير الآن
            </Btn>
          </div>
        </Sheet>
      </div>

      <Modal open={confirm} onClose={() => !busy && setConfirm(false)} title="تصفير البيانات"
        footer={<>
          <Btn onClick={() => setConfirm(false)} disabled={busy}>إلغاء</Btn>
          <Btn variant="primary" className="!bg-risk-700 hover:!bg-risk-700/90" onClick={reset} disabled={busy}>
            {busy ? <><Loader2 size={16} className="animate-spin" />جارٍ المسح…</> : 'نعم، صفّر'}
          </Btn>
        </>}>
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-risk-100 p-2 text-risk-700"><AlertTriangle size={18} /></span>
          <div className="min-w-0">
            <p className="text-base2 text-ink-900">سيُمسح من قاعدة البيانات:</p>
            <ul className="mt-2 space-y-1 text-panel text-ink-700">
              <li><Num className="font-medium">{stats?.students ?? 0}</Num> طالبًا</li>
              <li><Num className="font-medium">{stats?.halaqat ?? 0}</Num> حلقة</li>
              <li><Num className="font-medium">{stats?.imports ?? 0}</Num> عملية رفع</li>
              <li><Num className="font-medium">{stats?.audit ?? 0}</Num> سطرًا في سجلّ التدقيق</li>
            </ul>
            <p className="mt-3 text-panel text-ink-600">
              ومعها نسخة المتصفّح (<Num>{local.students}</Num> طالبًا).
              لا يمكن التراجع — لكن ملفات الإكسل عندك سليمة فترفعها متى شئت.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
