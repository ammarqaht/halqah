'use client';
/* طا-٣ شحن كود — one big field. The card came from the teacher's hand. */
import { useState } from 'react';
import { Ticket, CheckCircle2, XCircle } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty } from '@/components/ui';
import { Num } from '@/components/Num';
import { store, useDB } from '@/lib/store';
import { useStudentId, StudentPicker } from '@/components/StudentGate';
import { balanceOf, earnsPoints, normaliseCode, CODE_STATE_AR } from '@/lib/points';
import { cx } from '@/lib/cx';

type Result =
  | { ok: true; value: number; balance: number }
  | { ok: false; message: string };

export default function Redeem() {
  const db = useDB();
  const [id, setId] = useStudentId();
  const me = db.students.find((s) => s.id === id) ?? null;
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  if (!me) return <StudentPicker onPick={setId} />;

  if (!earnsPoints(me)) {
    return (
      <div className="mx-auto max-w-lg px-5 py-10">
        <Empty icon={Ticket} title="لا نقاط في مسار التلقين"
          body="طلاب التلقين خارج نظام النقاط والمتجر." />
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normaliseCode(code);
    if (!clean) return;
    const r = store.redeemCode(clean, me.id);
    if (r.ok) { setResult({ ok: true, value: r.value, balance: r.balance }); setCode(''); }
    else setResult({ ok: false, message: r.state === 'INELIGIBLE'
      ? 'هذا الحساب لا يستقبل نقاطًا.'
      : CODE_STATE_AR[r.state] ?? 'رقم غير صحيح.' });
  };

  return (
    <div className="mx-auto max-w-lg px-5 py-6">
      <h1 className="font-display text-d2 text-ink-900">شحن كود</h1>
      <p className="mt-2 text-base2 text-ink-600">
        اكتب الرقم المطبوع على البطاقة التي أعطاك إياها معلّمك.
      </p>
      <p className="mt-4 text-panel text-ink-500">
        رصيدك الآن: <Num className="font-medium text-ink-900">{balanceOf(db.txns, me.id)}</Num> نقطة
      </p>

      <form onSubmit={submit} className="mt-6">
        <input value={code} onChange={(e) => { setCode(e.target.value); setResult(null); }}
          dir="ltr" autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false}
          placeholder="XXXXX-XXXXX"
          aria-label="رقم البطاقة"
          className="h-16 w-full rounded-xl border-2 border-ink-200 bg-paper text-center font-mono text-[26px] tracking-[.18em] text-ink-900 placeholder:text-ink-300 focus:border-brand-700 focus:outline-none" />
        <Btn type="submit" variant="primary" size="xl" className="mt-4 w-full" disabled={!code.trim()}>
          شحن
        </Btn>
      </form>

      {result && (
        <Sheet className={cx('fade mt-5', result.ok ? 'border-ok-200 bg-ok-100' : 'border-risk-200 bg-risk-100')}>
          {result.ok ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-ok-700" />
              <div>
                <p className="text-lg2 font-medium text-ok-700">
                  أُضيفت <Num>{result.value}</Num> نقطة
                </p>
                <p className="mt-1 text-base2 text-ink-700">
                  رصيدك الآن <Num className="font-medium">{result.balance}</Num> نقطة.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <XCircle size={22} className="mt-0.5 shrink-0 text-risk-700" />
              <p className="text-lg2 text-risk-700">{result.message}</p>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
