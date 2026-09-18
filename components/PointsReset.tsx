'use client';
/* تصفير النقاط وسجلّها — «أضف زرًّا أسفل صفحة النقاط لتصفير النقاط وسجل النقاط،
   ونافذة تأكيد بنفس طريقة تصفير البيانات» (client, 18 Sep 2026), and then:
   «بلوك تصفير النقاط أبيه يكون بنفس تنسيق تصفير البيانات بالضبط».

   So it is the same block, down to the warn-tinted strip and the red word on the
   button — because it is the same KIND of act, and a lever with no undo should
   look like the other lever with no undo rather than like a card that happens to
   be red. The phrase is checked on the SERVER: a check that lives in a dialog is
   one anyone can skip by calling the endpoint.

   It is narrower than the database reset and says so. What it empties is the
   economy — movements, codes, orders — and what it leaves is everything a boy
   DID: his days, his recitation, his exams, his مقرّر. Those are a term's work,
   and they are not money. The gift shelf stays too: prices and stock are
   configuration the supervisor typed, and wiping them would make him retype the
   shop to reset a ledger. */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Coins, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, INPUT, Modal } from '@/components/ui';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';

type Done = { txns: number; codes: number; orders: number };

export function PointsResetCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<Done | null>(null);

  const reset = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/reset-points', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'تعذّر التصفير.'); return; }
      setDone(d.before as Done);
      setOpen(false); setPhrase('');
      router.refresh();
    } catch { setErr('تعذّر الاتصال بالخادم.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Sheet className="rise border-warn-200">
        <SheetHead title="تصفير النقاط"
          meta="الأرصدة وسجلّ الحركات والأكواد وطلبات المتجر — ولا يمسّ الطلاب ولا أيامهم" />

        {done && (
          <div className="fade mb-4 flex items-center gap-3 rounded-xl border border-ok-200 bg-ok-100 p-4">
            <CheckCircle2 size={18} className="shrink-0 text-ok-700" />
            <p className="text-panel text-ok-700">
              صُفّرت — <Num className="font-medium">{done.txns}</Num> حركة
              و<Num className="font-medium">{done.codes}</Num> كودًا
              و<Num className="font-medium">{done.orders}</Num> طلبًا. الأرصدة صفر عند الجميع.
            </p>
          </div>
        )}

        {err && !open && (
          <p role="alert" className="mb-4 rounded-xl border border-risk-200 bg-risk-100 px-4 py-3 text-panel text-risk-700">
            {err}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-warn-100/60 p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-body font-medium text-ink-900">
              <Coins size={16} className="text-warn-700" />
              تصفير النقاط وسجلّها
            </p>
            <p className="mt-1 max-w-[40rem] text-panel text-ink-600">
              يمسح حركات النقاط — والرصيد مجموعها فيصبح صفرًا عند الجميع — والأكواد
              ودفعاتها وطلبات المتجر. <strong>لا يمسّ الطلاب ولا الحلقات ولا الخطط ولا
              الاختبارات ولا الأيام المسجَّلة ولا هدايا المتجر.</strong>
            </p>
          </div>
          <Btn icon={Trash2} className="text-risk-700"
            onClick={() => { setErr(''); setOpen(true); }}>
            صفّر الآن
          </Btn>
        </div>
      </Sheet>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="تصفير النقاط"
        footer={<>
          <Btn onClick={() => setOpen(false)} disabled={busy}>إلغاء</Btn>
          <Btn variant="primary" className="!bg-risk-700 hover:!bg-risk-700/90"
            onClick={reset} disabled={busy || phrase.trim().length < 4}>
            {busy ? <><Loader2 size={16} className="animate-spin" />جارٍ المسح…</> : 'نعم، صفّر'}
          </Btn>
        </>}>
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-risk-100 p-2 text-risk-700"><AlertTriangle size={18} /></span>
          <div className="min-w-0">
            <p className="text-base2 text-ink-900">سيُمسح من قاعدة البيانات:</p>
            <ul className="mt-2 space-y-1 text-panel text-ink-700">
              <li>حركات النقاط كلها — فيعود رصيد كل طالب إلى صفر</li>
              <li>الأكواد ودفعاتها</li>
              <li>طلبات المتجر</li>
            </ul>
            <p className="mt-3 text-panel text-ink-600">
              ويبقى الطلاب والحلقات والخطط والاختبارات وأيام الحلقة المسجَّلة وهدايا
              المتجر. لا يمكن التراجع.
            </p>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs2 font-medium text-ink-700">
                اكتب الرمز السرّي للتأكيد
              </span>
              <input value={phrase} onChange={(e) => setPhrase(e.target.value)}
                inputMode="numeric" dir="ltr" autoComplete="off"
                aria-label="الرمز السرّي للتصفير"
                className={cx(INPUT, 'h-12 text-center tracking-[.4em]')} />
            </label>

            {err && (
              <p role="alert" className="mt-3 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
                {err}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
